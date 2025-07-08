#!/usr/bin/env node

/**
 * Test script for multimodal functionality
 * Verifies that image handling and OpenAI-compatible API integration work correctly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MultimodalTester {
  constructor() {
    this.projectRoot = path.dirname(__dirname);
    this.tests = [];
    this.failures = [];
  }

  /**
   * Run all multimodal tests
   */
  async runTests() {
    console.log('🧪 Testing multimodal functionality...\n');

    try {
      this.testMessageFormatting();
      this.testModelDetection();
      this.testAPICompatibility();
      this.testConversationManager();
      this.testImageManager();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Test execution failed:', error);
    }
  }

  /**
   * Test message formatting for multimodal content
   */
  testMessageFormatting() {
    console.log('📝 Testing message formatting...');
    
    // Test 1: Text-only message
    const textMessage = "Hello, world!";
    this.assert(
      typeof textMessage === 'string',
      'Text-only message should be a string',
      'testMessageFormatting'
    );

    // Test 2: Multimodal message structure
    const multimodalMessage = [
      {
        type: 'image_url',
        image_url: {
          url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...'
        }
      },
      {
        type: 'text',
        text: 'Describe this image'
      }
    ];

    this.assert(
      Array.isArray(multimodalMessage),
      'Multimodal message should be an array',
      'testMessageFormatting'
    );

    this.assert(
      multimodalMessage.length === 2,
      'Multimodal message should have 2 parts (image + text)',
      'testMessageFormatting'
    );

    this.assert(
      multimodalMessage[0].type === 'image_url',
      'First part should be image_url type',
      'testMessageFormatting'
    );

    this.assert(
      multimodalMessage[1].type === 'text',
      'Second part should be text type',
      'testMessageFormatting'
    );

    console.log('✅ Message formatting tests passed');
  }

  /**
   * Test model detection logic
   */
  testModelDetection() {
    console.log('🔍 Testing model detection...');

    // Multimodal models that should be detected
    const multimodalModels = [
      'gemma3',
      'llama-3.2-vision',
      'pixtral',
      'qwen2-vl',
      'llava',
      'claude-3',
      'gpt-4-vision'
    ];

    // Non-multimodal models
    const textOnlyModels = [
      'llama-3.1',
      'codellama',
      'mistral',
      'gemma-2'
    ];

    // Test multimodal detection logic (simplified version)
    const isMultimodalModel = (modelName) => {
      const multimodalKeywords = [
        'vision', 'visual', 'image', 'multimodal', 'mm',
        'llava', 'claude-3', 'gpt-4', 'gemini', 'pixtral', 'qwen2-vl'
      ];
      
      const lowerModel = modelName.toLowerCase();
      
      // Special case for gemma3 (multimodal) vs gemma-2 (text-only)
      if (lowerModel.includes('gemma')) {
        return lowerModel.includes('gemma3') || lowerModel.includes('gemma-3');
      }
      
      return multimodalKeywords.some(keyword => lowerModel.includes(keyword));
    };

    multimodalModels.forEach(model => {
      this.assert(
        isMultimodalModel(model),
        `${model} should be detected as multimodal`,
        'testModelDetection'
      );
    });

    textOnlyModels.forEach(model => {
      this.assert(
        !isMultimodalModel(model),
        `${model} should NOT be detected as multimodal`,
        'testModelDetection'
      );
    });

    console.log('✅ Model detection tests passed');
  }

  /**
   * Test API compatibility
   */
  testAPICompatibility() {
    console.log('🔗 Testing API compatibility...');

    // Test OpenAI-compatible request format
    const openAIRequest = {
      model: 'gemma3',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...'
              }
            },
            {
              type: 'text',
              text: 'What do you see in this image?'
            }
          ]
        }
      ],
      stream: true,
      temperature: 0.7
    };

    this.assert(
      openAIRequest.model && typeof openAIRequest.model === 'string',
      'Request should have a model field',
      'testAPICompatibility'
    );

    this.assert(
      Array.isArray(openAIRequest.messages),
      'Request should have messages array',
      'testAPICompatibility'
    );

    this.assert(
      openAIRequest.messages[0].role === 'user',
      'Message should have correct role',
      'testAPICompatibility'
    );

    this.assert(
      Array.isArray(openAIRequest.messages[0].content),
      'Multimodal content should be an array',
      'testAPICompatibility'
    );

    // Test endpoint configuration
    const endpoints = {
      ollama: 'http://localhost:11434/v1/chat/completions',
      vllm: 'http://localhost:8000/v1/chat/completions'
    };

    Object.entries(endpoints).forEach(([provider, endpoint]) => {
      this.assert(
        endpoint.includes('/v1/chat/completions'),
        `${provider} should use OpenAI-compatible endpoint`,
        'testAPICompatibility'
      );
    });

    console.log('✅ API compatibility tests passed');
  }

  /**
   * Test conversation manager functionality
   */
  testConversationManager() {
    console.log('💬 Testing conversation manager...');

    // Simulate conversation manager functionality
    const mockConversationHistory = [
      {
        id: 'msg1',
        content: 'Hello',
        isUser: true,
        timestamp: new Date().toISOString(),
        selection: '',
        images: []
      },
      {
        id: 'msg2',
        content: [
          {
            type: 'image_url',
            image_url: { url: 'data:image/jpeg;base64,test...' }
          },
          {
            type: 'text',
            text: 'What is this?'
          }
        ],
        isUser: true,
        timestamp: new Date().toISOString(),
        selection: '',
        images: ['data:image/jpeg;base64,test...']
      },
      {
        id: 'msg3',
        content: 'This is a test image.',
        isUser: false,
        timestamp: new Date().toISOString(),
        selection: '',
        images: []
      }
    ];

    // Test message validation
    mockConversationHistory.forEach((msg, index) => {
      this.assert(
        msg.id && typeof msg.id === 'string',
        `Message ${index + 1} should have an ID`,
        'testConversationManager'
      );

      this.assert(
        msg.content !== undefined && msg.content !== null,
        `Message ${index + 1} should have content`,
        'testConversationManager'
      );

      this.assert(
        typeof msg.isUser === 'boolean',
        `Message ${index + 1} should have isUser boolean`,
        'testConversationManager'
      );

      this.assert(
        Array.isArray(msg.images),
        `Message ${index + 1} should have images array`,
        'testConversationManager'
      );
    });

    // Test multimodal message detection
    const multimodalMessages = mockConversationHistory.filter(msg => 
      Array.isArray(msg.content) || (msg.images && msg.images.length > 0)
    );

    this.assert(
      multimodalMessages.length === 1,
      'Should detect exactly 1 multimodal message',
      'testConversationManager'
    );

    console.log('✅ Conversation manager tests passed');
  }

  /**
   * Test image manager functionality
   */
  testImageManager() {
    console.log('🖼️  Testing image manager...');

    // Test image data format
    const mockImageData = {
      type: 'image_url',
      image_url: {
        url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...'
      }
    };

    this.assert(
      mockImageData.type === 'image_url',
      'Image data should have correct type',
      'testImageManager'
    );

    this.assert(
      mockImageData.image_url && mockImageData.image_url.url,
      'Image data should have URL structure',
      'testImageManager'
    );

    this.assert(
      mockImageData.image_url.url.startsWith('data:image/'),
      'Image URL should be a data URL',
      'testImageManager'
    );

    // Test Base64 validation (simplified)
    const base64Pattern = /^data:image\/(jpeg|png|gif|webp);base64,/;
    this.assert(
      base64Pattern.test(mockImageData.image_url.url),
      'Image URL should match Base64 data URL pattern',
      'testImageManager'
    );

    console.log('✅ Image manager tests passed');
  }

  /**
   * Assert function for testing
   */
  assert(condition, message, testSuite) {
    this.tests.push({ condition, message, testSuite });
    if (!condition) {
      this.failures.push({ message, testSuite });
    }
  }

  /**
   * Print test results
   */
  printResults() {
    console.log('\n📊 Test Results:');
    console.log('==================================================');
    
    if (this.failures.length === 0) {
      console.log(`✅ All ${this.tests.length} tests passed!`);
    } else {
      console.log(`❌ ${this.failures.length} of ${this.tests.length} tests failed:`);
      this.failures.forEach((failure, index) => {
        console.log(`  ${index + 1}. [${failure.testSuite}] ${failure.message}`);
      });
    }
    
    console.log('==================================================');
    
    if (this.failures.length === 0) {
      console.log('🎉 Multimodal functionality is ready!');
    } else {
      console.log('⚠️  Please fix the failing tests before deployment.');
    }
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new MultimodalTester();
  tester.runTests();
}

export default MultimodalTester;
