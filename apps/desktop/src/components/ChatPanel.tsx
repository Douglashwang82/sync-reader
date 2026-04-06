import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { wsService } from '../services/WebSocketService';
import { validateMessage } from '@sync-reader/shared';

export default function ChatPanel() {
  const { 
    messages, 
    currentMessage, 
    isAIResponding, 
    aiResponse,
    setCurrentMessage, 
    addMessage, 
    setIsAIResponding, 
    clearAIResponse 
  } = useAppStore();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiResponse]);

  const handleSendMessage = () => {
    if (!validateMessage(currentMessage) || isAIResponding) return;

    // Add user message
    const userMessage = {
      id: `user-${Date.now()}`,
      sessionId: 'current', // This would be populated properly by the server
      content: currentMessage,
      timestamp: Date.now(),
      type: 'user' as const
    };

    addMessage(userMessage);
    
    // Start AI response
    setIsAIResponding(true);
    clearAIResponse();
    
    // Send to server
    wsService.sendQuestion(currentMessage);
    
    // Clear input
    setCurrentMessage('');
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.type}`}>
            {message.content}
          </div>
        ))}
        
        {/* AI response in progress */}
        {isAIResponding && aiResponse && (
          <div className="message ai">
            {aiResponse}
            <span style={{ opacity: 0.6 }}>▊</span>
          </div>
        )}
        
        {/* Thinking indicator */}
        {isAIResponding && !aiResponse && (
          <div className="message ai">
            <span style={{ opacity: 0.6 }}>AI is thinking...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="message-input">
        <input
          ref={inputRef}
          type="text"
          value={currentMessage}
          onChange={(e) => setCurrentMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask about what you're reading on your phone..."
          disabled={isAIResponding}
          maxLength={1000}
        />
        <button
          className="send-button"
          onClick={handleSendMessage}
          disabled={!validateMessage(currentMessage) || isAIResponding}
        >
          Send
        </button>
      </div>
    </>
  );
}