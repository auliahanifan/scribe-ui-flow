interface SOAPSection {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface PatientContext {
  id: string;
  name: string;
  age?: number;
  medicalHistory?: string[];
  allergies?: string[];
  currentMedications?: string[];
}

interface SOAPGenerationRequest {
  transcription: string;
  patientContext?: PatientContext;
  visitType?: string;
  chiefComplaint?: string;
}

interface SOAPGenerationResponse {
  soapNote: SOAPSection;
  confidence: number;
  generatedAt: string;
  warnings?: string[];
}

class OpenAISOAPService {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENROUTER_API_KEY || '';
    this.baseUrl = 'https://openrouter.ai/api/v1';
    this.model = 'openai/gpt-4o-mini'; // OpenRouter model format
    
    if (!this.apiKey) {
      console.warn('OpenRouter API key not found. Please set VITE_OPENROUTER_API_KEY environment variable.');
    }
  }

  async generateSOAP(request: SOAPGenerationRequest): Promise<SOAPGenerationResponse> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key is required for SOAP note generation');
    }

    try {
      const prompt = this.createSOAPPrompt(request);
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Asha Health - Medical Scribe'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3, // Lower temperature for more consistent medical documentation
          max_tokens: 2000,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content received from OpenRouter API');
      }

      const parsedContent = JSON.parse(content);
      
      return {
        soapNote: {
          subjective: parsedContent.subjective || 'No subjective information provided.',
          objective: parsedContent.objective || 'No objective findings documented.',
          assessment: parsedContent.assessment || 'Assessment not completed.',
          plan: parsedContent.plan || 'Plan to be determined.'
        },
        confidence: parsedContent.confidence || 0.8,
        generatedAt: new Date().toISOString(),
        warnings: parsedContent.warnings || []
      };

    } catch (error) {
      console.error('Error generating SOAP note:', error);
      throw new Error(`Failed to generate SOAP note: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getSystemPrompt(): string {
    return `You are an AI assistant specialized in creating medical SOAP notes from patient-provider conversation transcriptions. Your role is to analyze the conversation and extract relevant information to create a structured SOAP note.

IMPORTANT GUIDELINES:
1. Only include information explicitly mentioned in the transcription
2. Do not make assumptions or add information not present in the conversation
3. Use medical terminology appropriately but ensure clarity
4. If information is unclear or missing, note it explicitly
5. Always include disclaimers about AI-generated content requiring physician review
6. Maintain patient confidentiality and professional medical standards

OUTPUT FORMAT:
Return a JSON object with the following structure:
{
  "subjective": "Patient's reported symptoms, concerns, and history as stated",
  "objective": "Observable findings, vital signs, physical exam results mentioned",
  "assessment": "Clinical interpretation and diagnosis based on the information provided",
  "plan": "Treatment plan, follow-up instructions, and next steps discussed",
  "confidence": 0.8,
  "warnings": ["List any concerns about missing information or unclear statements"]
}

Remember: This is AI-generated content that requires review and validation by a licensed healthcare provider.`;
  }

  private createSOAPPrompt(request: SOAPGenerationRequest): string {
    let prompt = `Please create a SOAP note from the following patient-provider conversation transcription:\n\n`;
    
    prompt += `TRANSCRIPTION:\n${request.transcription}\n\n`;

    if (request.patientContext) {
      prompt += `PATIENT CONTEXT:\n`;
      prompt += `Name: ${request.patientContext.name}\n`;
      if (request.patientContext.age) prompt += `Age: ${request.patientContext.age}\n`;
      if (request.patientContext.medicalHistory?.length) {
        prompt += `Medical History: ${request.patientContext.medicalHistory.join(', ')}\n`;
      }
      if (request.patientContext.allergies?.length) {
        prompt += `Allergies: ${request.patientContext.allergies.join(', ')}\n`;
      }
      if (request.patientContext.currentMedications?.length) {
        prompt += `Current Medications: ${request.patientContext.currentMedications.join(', ')}\n`;
      }
      prompt += `\n`;
    }

    if (request.visitType) {
      prompt += `VISIT TYPE: ${request.visitType}\n\n`;
    }

    if (request.chiefComplaint) {
      prompt += `CHIEF COMPLAINT: ${request.chiefComplaint}\n\n`;
    }

    prompt += `Please analyze this transcription and create a comprehensive SOAP note. Focus on:
- Extracting only information explicitly mentioned in the conversation
- Organizing information into appropriate SOAP sections
- Noting any areas where information is unclear or missing
- Providing a confidence score based on the clarity and completeness of the transcription

Return the response as a JSON object as specified in your system instructions.`;

    return prompt;
  }

  // Method to validate transcription quality before SOAP generation
  validateTranscription(transcription: string): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    if (transcription.length < 50) {
      issues.push('Transcription is too short for meaningful SOAP note generation');
    }

    if (transcription.split(' ').length < 20) {
      issues.push('Transcription contains insufficient content');
    }

    // Check for common transcription issues
    const garbledRatio = (transcription.match(/\b[a-z]{1,3}\b/g) || []).length / transcription.split(' ').length;
    if (garbledRatio > 0.3) {
      issues.push('Transcription may contain garbled or incomplete words');
    }

    // Check for medical context indicators
    const medicalTerms = ['patient', 'symptoms', 'pain', 'medication', 'history', 'exam', 'vital', 'treatment'];
    const hasMedicalContext = medicalTerms.some(term => 
      transcription.toLowerCase().includes(term)
    );

    if (!hasMedicalContext) {
      issues.push('Transcription may not contain medical conversation content');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  // Method to get a quick summary before full SOAP generation
  async generateQuickSummary(transcription: string): Promise<string> {
    if (!this.apiKey) {
      return 'OpenRouter API key required for summary generation';
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Asha Health - Medical Scribe'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'Provide a brief 2-3 sentence summary of this medical conversation transcription.'
            },
            {
              role: 'user',
              content: `Transcription: ${transcription}`
            }
          ],
          temperature: 0.3,
          max_tokens: 150
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || 'Summary not available';

    } catch (error) {
      console.error('Error generating summary:', error);
      return 'Error generating summary';
    }
  }
}

// Create singleton instance - Uses OpenRouter for AI model access
export const openaiSOAPService = new OpenAISOAPService();
export type { SOAPSection, PatientContext, SOAPGenerationRequest, SOAPGenerationResponse };