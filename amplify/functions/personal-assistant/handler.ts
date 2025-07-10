import {
  BedrockRuntimeClient,
  ConverseCommandInput,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { Handler } from "aws-lambda";

// Types for message content
interface TextContent {
  text: string;
}

interface ImageContent {
  image: {
    format: string;
    source: {
      bytes: string | Buffer;
    };
  };
}

type MessageContent = TextContent | ImageContent;

interface Message {
  role: string;
  content: MessageContent[];
}

type Conversation = Message[];

// Constants
const AWS_REGION = process.env.AWS_REGION;
const MODEL_ID = process.env.MODEL_ID;

// Configuration
const INFERENCE_CONFIG = {
  maxTokens: 1000,
  temperature: 0.5,
};

// Initialize Bedrock Runtime Client
const client = new BedrockRuntimeClient({ region: AWS_REGION });

// Helper function to process messages and convert base64 images to bytes
const processMessages = (conversation: string | Message[]): Message[] => {
  let parsedConversation: Message[];
  
  try {
    // conversationが既にオブジェクトの場合はそのまま使用、文字列の場合はパース
    if (typeof conversation === 'string') {
      console.log('Parsing conversation string...');
      parsedConversation = JSON.parse(conversation);
    } else {
      console.log('Using conversation object directly...');
      parsedConversation = conversation;
    }
  } catch (error) {
    console.error('Failed to parse conversation:', error);
    throw new Error('Invalid conversation format');
  }
  
  return parsedConversation.map((message) => ({
    ...message,
    content: message.content.map((content) => {
      if ('image' in content && content.image.source.bytes) {
        // Only process if bytes is a string (base64 data)
        if (typeof content.image.source.bytes === 'string') {
          // Convert base64 string to Buffer for Bedrock API
          const base64Data = content.image.source.bytes.replace(/^data:image\/[a-z]+;base64,/, '');
          const binaryData = Buffer.from(base64Data, 'base64');
          
          return {
            image: {
              format: content.image.format,
              source: {
                bytes: binaryData
              }
            }
          };
        }
      }
      return content;
    })
  }));
};

export const handler: Handler = async (event) => {
  const { conversation } = event.arguments;

  const SYSTEM_PROMPT = `
  You are a personalized travel planning assistant with vision capabilities. When users share images of destinations, 
  landmarks, food, or travel-related content, analyze them and provide relevant travel advice. Create personalized 
  travel planning experiences by greeting users warmly and inquiring about their travel preferences such as destination, 
  dates, budget, and interests. Based on their input and any images they share, suggest tailored itineraries that include 
  popular attractions, local experiences, and hidden gems, along with accommodation options across various price ranges 
  and styles. Provide transportation recommendations, including flights and car rentals, along with estimated costs and 
  travel times. Recommend dining experiences that align with dietary needs, and share insights on local customs, 
  necessary travel documents, and packing essentials. When analyzing images, describe what you see and provide relevant 
  travel recommendations based on the visual content. Highlight the importance of travel insurance, offer real-time 
  updates on weather and events, and allow users to save and modify their itineraries. Additionally, provide a budget 
  tracking feature and the option to book flights and accommodations directly or through trusted platforms, all while 
  maintaining a warm and approachable tone to enhance the excitement of trip planning.
`;

  try {
    // Process the conversation to handle image data
    const processedMessages = processMessages(conversation);

    const input = {
      modelId: MODEL_ID,
      system: [{ text: SYSTEM_PROMPT }],
      messages: processedMessages,
      inferenceConfig: INFERENCE_CONFIG,
    } as ConverseCommandInput;

    const command = new ConverseCommand(input);
    const response = await client.send(command);

    if (!response.output?.message) {
      throw new Error("No message in the response output");
    }

    return JSON.stringify(response.output.message);
  } catch (error) {
    console.error("Error in chat handler:", error);
    throw error; // Re-throw to be handled by AWS Lambda
  }
};
