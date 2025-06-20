#!/usr/bin/env node

/**
 * Validation script for LLM Chrome Extension
 * Checks for common issues and validates the extension structure
 */

const fs = require('fs');
const path = require('path');

class ExtensionValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.projectRoot = path.dirname(__dirname);
  }

  /**
   * Main validation function
   */
  async validate() {
    console.log('🔍 Validating LLM Chrome Extension...\n');

    try {
      this.validateManifest();
      this.validateFileStructure();
      this.validateModules();
      this.validateConfiguration();
      this.validateSyntax();

      this.printResults();
      
      if (this.errors.length > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Validate manifest.json
   */
  validateManifest() {
    const manifestPath = path.join(this.projectRoot, 'manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      this.errors.push('manifest.json not found');
      return;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      // Check required fields
      const required = ['manifest_version', 'name', 'version', 'description'];
      for (const field of required) {
        if (!manifest[field]) {
          this.errors.push(`manifest.json missing required field: ${field}`);
        }
      }

      // Check manifest version
      if (manifest.manifest_version !== 3) {
        this.warnings.push('Consider using manifest version 3');
      }

      // Check permissions
      if (!manifest.permissions || !Array.isArray(manifest.permissions)) {
        this.warnings.push('No permissions specified in manifest');
      }

    } catch (error) {
      this.errors.push(`Invalid manifest.json: ${error.message}`);
    }
  }

  /**
   * Validate file structure
   */
  validateFileStructure() {
    const requiredFiles = [
      'background.js',
      'content.js',
      'config.js',
      'popup.js',
      'popup.html',
      'sidepanel.html',
      'styles.css'
    ];

    const requiredDirs = [
      'src',
      'src/constants',
      'src/modules',
      'src/utils'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(this.projectRoot, file);
      if (!fs.existsSync(filePath)) {
        this.errors.push(`Required file missing: ${file}`);
      }
    }

    for (const dir of requiredDirs) {
      const dirPath = path.join(this.projectRoot, dir);
      if (!fs.existsSync(dirPath)) {
        this.errors.push(`Required directory missing: ${dir}`);
      }
    }
  }

  /**
   * Validate module files
   */
  validateModules() {
    const moduleFiles = [
      'src/llm-chat-app.js',
      'src/constants/app-constants.js',
      'src/modules/conversation-manager.js',
      'src/modules/selection-manager.js',
      'src/modules/llm-manager.js',
      'src/modules/ui-manager.js',
      'src/utils/chrome-utils.js',
      'src/utils/dom-utils.js',
      'src/utils/general-utils.js',
      'src/utils/error-handler.js'
    ];

    for (const moduleFile of moduleFiles) {
      const filePath = path.join(this.projectRoot, moduleFile);
      
      if (!fs.existsSync(filePath)) {
        this.errors.push(`Module file missing: ${moduleFile}`);
        continue;
      }

      try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for basic ES6 module structure
        if (!content.includes('export')) {
          this.warnings.push(`${moduleFile} may not be properly structured as ES6 module`);
        }

        // Check for proper JSDoc comments
        if (!content.includes('/**')) {
          this.warnings.push(`${moduleFile} missing JSDoc documentation`);
        }

      } catch (error) {
        this.errors.push(`Error reading ${moduleFile}: ${error.message}`);
      }
    }
  }

  /**
   * Validate configuration
   */
  validateConfiguration() {
    const configPath = path.join(this.projectRoot, 'config.js');
    
    if (!fs.existsSync(configPath)) {
      this.errors.push('config.js not found');
      return;
    }

    try {
      const content = fs.readFileSync(configPath, 'utf8');
      
      // Check for required configuration objects
      if (!content.includes('MODEL_CONFIG')) {
        this.errors.push('MODEL_CONFIG not found in config.js');
      }

      if (!content.includes('apiConfig')) {
        this.errors.push('apiConfig not found in config.js');
      }

      // Check for placeholder values
      if (content.includes('YOUR_ENDPOINT') || content.includes('YOUR_API_KEY')) {
        this.warnings.push('Configuration contains placeholder values');
      }

    } catch (error) {
      this.errors.push(`Error reading config.js: ${error.message}`);
    }
  }

  /**
   * Basic syntax validation
   */
  validateSyntax() {
    const jsFiles = this.getAllJSFiles();
    
    for (const jsFile of jsFiles) {
      try {
        const content = fs.readFileSync(jsFile, 'utf8');
        
        // Basic syntax checks
        const openBraces = (content.match(/{/g) || []).length;
        const closeBraces = (content.match(/}/g) || []).length;
        
        if (openBraces !== closeBraces) {
          this.warnings.push(`Possible brace mismatch in ${path.relative(this.projectRoot, jsFile)}`);
        }

        const openParens = (content.match(/\(/g) || []).length;
        const closeParens = (content.match(/\)/g) || []).length;
        
        if (openParens !== closeParens) {
          this.warnings.push(`Possible parentheses mismatch in ${path.relative(this.projectRoot, jsFile)}`);
        }

      } catch (error) {
        this.errors.push(`Error validating syntax in ${path.relative(this.projectRoot, jsFile)}: ${error.message}`);
      }
    }
  }

  /**
   * Get all JavaScript files in the project
   */
  getAllJSFiles() {
    const jsFiles = [];
    
    const scanDirectory = (dir) => {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          scanDirectory(filePath);
        } else if (file.endsWith('.js')) {
          jsFiles.push(filePath);
        }
      }
    };

    scanDirectory(this.projectRoot);
    return jsFiles;
  }

  /**
   * Print validation results
   */
  printResults() {
    console.log('\n📊 Validation Results:');
    console.log('='.repeat(50));

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ All validations passed!');
      return;
    }

    if (this.errors.length > 0) {
      console.log(`\n❌ Errors (${this.errors.length}):`);
      this.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${this.warnings.length}):`);
      this.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }

    console.log('\n' + '='.repeat(50));
    
    if (this.errors.length > 0) {
      console.log('❌ Validation failed. Please fix the errors above.');
    } else {
      console.log('✅ Validation passed with warnings.');
    }
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const validator = new ExtensionValidator();
  validator.validate();
}

module.exports = ExtensionValidator;
