import React, { ChangeEvent, useEffect, useRef, useState } from "react";
import { Button, Placeholder, View } from "@aws-amplify/ui-react";
import { amplifyClient } from "@/app/amplify-utils";

// Types
interface TextContent {
  text: string;
}

interface ImageContent {
  image: {
    format: string;
    source: {
      bytes: string;
    };
  };
}

type MessageContent = TextContent | ImageContent;

type Message = {
  role: string;
  content: MessageContent[];
};

type Conversation = Message[];

export function Chat() {
  const [conversation, setConversation] = useState<Conversation>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesRef = useRef(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError("");
    setInputValue(e.target.value);
  };

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
        return;
      }

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }

      setSelectedImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      setError("");
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inputValue.trim() || selectedImage) {
      const message = createUserMessage();
      fetchChatResponse(message);
    }
  };

  const fetchChatResponse = async (message: Message) => {
    setIsLoading(true);

    try {
      // 新しいメッセージを含む会話全体を送信
      const updatedConversation = [...conversation, message];
      console.log('🔍 Sending conversation:', updatedConversation);
      
      const { data, errors } = await amplifyClient.queries.chat({
        conversation: JSON.stringify(updatedConversation),
      });

      console.log('🔍 Raw response data:', data);
      console.log('🔍 Data type:', typeof data);
      console.log('🔍 Data constructor:', data?.constructor?.name);
      console.log('🔍 Is string?', typeof data === 'string');
      console.log('🔍 Errors:', errors);

      if (!errors && data) {
        console.log('🔍 Processing response data...');
        
        let responseMessage: Message;
        
        if (typeof data === 'string') {
          console.log('🔍 Data is string, attempting to parse...');
          try {
            responseMessage = JSON.parse(data);
            console.log('🔍 Successfully parsed string data:', responseMessage);
          } catch (parseError) {
            console.error('❌ Failed to parse string data:', parseError);
            throw new Error('Failed to parse response data');
          }
        } else {
          console.log('🔍 Data is already an object:', data);
          responseMessage = data as Message;
        }
        
        setConversation((prevConversation) => [
          ...prevConversation,
          message, // ユーザーメッセージを追加
          responseMessage, // AIの応答を追加
        ]);
      } else {
        console.log('🔍 Processing errors:', errors);
        const errorMessage = errors?.[0]?.message || 
                           errors?.[0]?.errorType || 
                           (typeof errors?.[0] === 'object' ? JSON.stringify(errors?.[0]) : String(errors?.[0])) ||
                           "An unknown error occurred.";
        throw new Error(errorMessage);
      }
    } catch (err) {
      setError((err as Error).message);
      console.error("❌ Error fetching chat response:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const lastMessage = conversation[conversation.length - 1];
    console.log("lastMessage", lastMessage);
    (
      messagesRef.current as HTMLDivElement | null
    )?.lastElementChild?.scrollIntoView();
  }, [conversation]);

  const createUserMessage = (): Message => {
    const content: MessageContent[] = [];
    
    // Add text content if present
    if (inputValue.trim()) {
      content.push({ text: inputValue });
    }
    
    // Add image content if present
    if (selectedImage && imagePreview) {
      const format = selectedImage.type.split('/')[1]; // Extract format from MIME type
      content.push({
        image: {
          format: format,
          source: {
            bytes: imagePreview // Base64 data URL
          }
        }
      });
    }

    const newUserMessage: Message = {
      role: "user",
      content: content,
    };

    // Clear inputs
    setInputValue("");
    removeImage();
    
    return newUserMessage;
  };

  const renderMessageContent = (content: MessageContent[]) => {
    return content.map((item, index) => {
      if ('text' in item) {
        return <div key={index} className="message-text">{item.text}</div>;
      } else if ('image' in item) {
        return (
          <div key={index} className="message-image">
            <img 
              src={item.image.source.bytes} 
              alt="Uploaded image" 
              style={{ maxWidth: '300px', maxHeight: '300px', borderRadius: '8px' }}
            />
          </div>
        );
      }
      return null;
    });
  };

  return (
    <View className="chat-container">
      <View className="messages" ref={messagesRef}>
        {conversation.map((msg, index) => (
          <View key={index} className={`message ${msg.role}`}>
            {renderMessageContent(msg.content)}
          </View>
        ))}
      </View>
      {isLoading && (
        <View className="loader-container">
          <p>Thinking...</p>
          <Placeholder size="large" />
        </View>
      )}

      {/* Image preview */}
      {imagePreview && (
        <View className="image-preview-container">
          <div className="image-preview">
            <img 
              src={imagePreview} 
              alt="Preview" 
              style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px' }}
            />
            <button 
              type="button" 
              onClick={removeImage}
              className="remove-image-btn"
              style={{ 
                position: 'absolute', 
                top: '5px', 
                right: '5px', 
                background: 'rgba(0,0,0,0.5)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '50%', 
                width: '24px', 
                height: '24px',
                cursor: 'pointer'
              }}
            >
              ×
            </button>
          </div>
        </View>
      )}

      <form onSubmit={handleSubmit} className="input-container">
        <div className="input-row">
          <input
            name="prompt"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Type your message..."
            className="input"
            type="text"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="image-button"
            variation="link"
          >
            📷
          </Button>
          <Button
            type="submit"
            className="send-button"
            isDisabled={isLoading || (!inputValue.trim() && !selectedImage)}
            loadingText="Sending..."
          >
            Send
          </Button>
        </div>
      </form>

      {error ? <View className="error-message">{error}</View> : null}
    </View>
  );
}

export default Chat;
