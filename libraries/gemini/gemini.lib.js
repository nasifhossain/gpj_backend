const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();
class Gemini {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        if (!this.apiKey) {
            throw new Error("GEMINI_API_KEY environment variable is required");
        }
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = "gemini-flash-latest";
    }

    initialize(modelName = "gemini-flash-latest") {
        this.model = this.genAI.getGenerativeModel({ model: modelName });
        return this;
    }

    getModel() {
        if (!this.model) {
            throw new Error("Model not initialized. Call initialize() first.");
        }
        return this.model;
    }

    async getResponse(prompt, inputFiles = []) {
        if (!this.model) {
            throw new Error("Model not initialized. Call initialize() first.");
        }

        if (!prompt) {
            throw new Error("Prompt is required");
        }

        try {
            let content;

            // If files are provided, include them with the prompt
            if (inputFiles && inputFiles.length > 0) {
                // Build content array with prompt and files
                content = [prompt, ...inputFiles];
            } else {
                // Only text prompt
                content = prompt;
            }

            const result = await this.model.generateContent(content);
            const response = await result.response;
            return response.text();
        } catch (error) {
            throw new Error(`Failed to generate response: ${error.message}`);
        }
    }
}

module.exports = Gemini;