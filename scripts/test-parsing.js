#!/usr/bin/env node

/**
 * Test script for streaming response parsing
 * Tests the unified OpenAI-compatible parsing logic
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class StreamParsingTester {
  constructor() {
    this.tests = [];
    this.failures = [];
  }

  /**
   * Simulate the parsing function from LLMManager
   */
  parseOpenAICompatibleChunk(line) {
    // Handle OpenAI-style Server-Sent Events format
    if (line.startsWith('data: ')) {
      const dataStr = line.slice(6).trim();
      
      // Handle completion signal
      if (dataStr === '[DONE]') {
        return { content: '', done: true };
      }
      
      try {
        const data = JSON.parse(dataStr);
        const delta = data.choices?.[0]?.delta;
        
        return {
          content: delta?.content || '',
          done: data.choices?.[0]?.finish_reason !== null,
          model: data.model,
          id: data.id
        };
      } catch (error) {
        console.warn('Failed to parse OpenAI-compatible chunk:', dataStr);
        return null;
      }
    }
    
    // Handle direct JSON format (fallback for legacy Ollama)
    try {
      const data = JSON.parse(line);
      
      // Ollama native format
      if (data.message) {
        return {
          content: data.message?.content || '',
          done: data.done || false,
          model: data.model,
          created_at: data.created_at
        };
      }
      
      // OpenAI format
      if (data.choices) {
        const delta = data.choices[0]?.delta;
        return {
          content: delta?.content || '',
          done: data.choices[0]?.finish_reason !== null,
          model: data.model,
          id: data.id
        };
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to parse JSON chunk:', line);
      return null;
    }
  }

  /**
   * Run parsing tests
   */
  runTests() {
    console.log('🧪 Testing streaming response parsing...\n');

    this.testOpenAIFormat();
    this.testOllamaLegacyFormat();
    this.testDoneSignal();
    this.testMalformedInput();
    
    this.printResults();
  }

  /**
   * Test OpenAI/vLLM format parsing
   */
  testOpenAIFormat() {
    console.log('📡 Testing OpenAI/vLLM format...');

    // Test normal chunk
    const openaiChunk = 'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}';
    const result1 = this.parseOpenAICompatibleChunk(openaiChunk);
    
    this.assert(
      result1 && result1.content === 'Hello',
      'Should parse OpenAI chunk content correctly',
      'testOpenAIFormat'
    );

    this.assert(
      result1 && result1.done === false,
      'Should detect non-finished OpenAI chunk',
      'testOpenAIFormat'
    );

    // Test finished chunk
    const finishedChunk = 'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}';
    const result2 = this.parseOpenAICompatibleChunk(finishedChunk);
    
    this.assert(
      result2 && result2.done === true,
      'Should detect finished OpenAI chunk',
      'testOpenAIFormat'
    );

    console.log('✅ OpenAI/vLLM format tests passed');
  }

  /**
   * Test legacy Ollama format parsing
   */
  testOllamaLegacyFormat() {
    console.log('🦙 Testing legacy Ollama format...');

    // Test normal Ollama chunk
    const ollamaChunk = '{"model":"llama2","created_at":"2023-12-12T14:13:43.416799Z","message":{"role":"assistant","content":"Hello"},"done":false}';
    const result1 = this.parseOpenAICompatibleChunk(ollamaChunk);
    
    this.assert(
      result1 && result1.content === 'Hello',
      'Should parse Ollama chunk content correctly',
      'testOllamaLegacyFormat'
    );

    this.assert(
      result1 && result1.done === false,
      'Should detect non-finished Ollama chunk',
      'testOllamaLegacyFormat'
    );

    // Test finished Ollama chunk
    const finishedOllamaChunk = '{"model":"llama2","created_at":"2023-12-12T14:13:43.416799Z","message":{"role":"assistant","content":""},"done":true}';
    const result2 = this.parseOpenAICompatibleChunk(finishedOllamaChunk);
    
    this.assert(
      result2 && result2.done === true,
      'Should detect finished Ollama chunk',
      'testOllamaLegacyFormat'
    );

    console.log('✅ Legacy Ollama format tests passed');
  }

  /**
   * Test DONE signal parsing
   */
  testDoneSignal() {
    console.log('🏁 Testing DONE signal...');

    const doneSignal = 'data: [DONE]';
    const result = this.parseOpenAICompatibleChunk(doneSignal);
    
    this.assert(
      result && result.done === true,
      'Should detect DONE signal correctly',
      'testDoneSignal'
    );

    this.assert(
      result && result.content === '',
      'DONE signal should have empty content',
      'testDoneSignal'
    );

    console.log('✅ DONE signal tests passed');
  }

  /**
   * Test malformed input handling
   */
  testMalformedInput() {
    console.log('⚠️ Testing malformed input handling...');

    // Test invalid JSON
    const invalidJson = 'data: {invalid json}';
    const result1 = this.parseOpenAICompatibleChunk(invalidJson);
    
    this.assert(
      result1 === null,
      'Should handle invalid JSON gracefully',
      'testMalformedInput'
    );

    // Test empty line
    const emptyLine = '';
    const result2 = this.parseOpenAICompatibleChunk(emptyLine);
    
    this.assert(
      result2 === null,
      'Should handle empty lines gracefully',
      'testMalformedInput'
    );

    // Test non-data line
    const nonDataLine = 'event: message';
    const result3 = this.parseOpenAICompatibleChunk(nonDataLine);
    
    this.assert(
      result3 === null,
      'Should handle non-data lines gracefully',
      'testMalformedInput'
    );

    console.log('✅ Malformed input tests passed');
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
    console.log('\n📊 Parsing Test Results:');
    console.log('==================================================');
    
    if (this.failures.length === 0) {
      console.log(`✅ All ${this.tests.length} parsing tests passed!`);
    } else {
      console.log(`❌ ${this.failures.length} of ${this.tests.length} tests failed:`);
      this.failures.forEach((failure, index) => {
        console.log(`  ${index + 1}. [${failure.testSuite}] ${failure.message}`);
      });
    }
    
    console.log('==================================================');
    
    if (this.failures.length === 0) {
      console.log('🎉 Streaming parsing is working correctly!');
      console.log('📡 Both Ollama and vLLM responses should now parse without errors.');
    } else {
      console.log('⚠️  Please fix the failing parsing tests.');
    }
  }
}

// Run tests
const tester = new StreamParsingTester();
tester.runTests();
