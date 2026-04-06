import sharp from 'sharp';
import type { Frame } from '../types/index.js';

interface FrameAnalysis {
  frame: Frame;
  score: number;
  reasons: string[];
}

export class ContextSelector {
  private readonly MAX_CONTEXT_FRAMES = 8;
  private readonly MIN_CONTEXT_FRAMES = 2;

  /**
   * Select the most relevant frames for a given question
   */
  async selectRelevantFrames(frames: Frame[], question: string): Promise<Frame[]> {
    if (frames.length === 0) {
      return [];
    }

    // If we have fewer frames than minimum, return all
    if (frames.length <= this.MIN_CONTEXT_FRAMES) {
      return frames.slice(0, this.MIN_CONTEXT_FRAMES);
    }

    // Analyze each frame for relevance
    const analyses = await Promise.all(
      frames.map(frame => this.analyzeFrame(frame, question))
    );

    // Sort by relevance score (highest first)
    analyses.sort((a, b) => b.score - a.score);

    // Always include the most recent frame
    const mostRecent = analyses[0];
    const selected = [mostRecent];
    
    // Add other high-scoring frames up to the limit
    for (let i = 1; i < analyses.length && selected.length < this.MAX_CONTEXT_FRAMES; i++) {
      const analysis = analyses[i];
      
      // Only include if score is above threshold or we haven't met minimum
      if (analysis.score > 0.3 || selected.length < this.MIN_CONTEXT_FRAMES) {
        selected.push(analysis);
      }
    }

    console.log(`🎯 Selected ${selected.length} frames from ${frames.length} available`);
    for (const analysis of selected) {
      console.log(`   Frame ${analysis.frame.id}: score=${analysis.score.toFixed(2)} reasons=[${analysis.reasons.join(', ')}]`);
    }

    return selected.map(a => a.frame);
  }

  /**
   * Analyze a frame for relevance to the question
   */
  private async analyzeFrame(frame: Frame, question: string): Promise<FrameAnalysis> {
    const reasons: string[] = [];
    let score = 0;

    // Base score for recency (newest frames get higher base score)
    const age = Date.now() - frame.timestamp.getTime();
    const ageInMinutes = age / (1000 * 60);
    const recencyScore = Math.max(0, 1 - (ageInMinutes / 30)); // Decay over 30 minutes
    score += recencyScore * 0.5;
    if (recencyScore > 0.7) reasons.push('recent');

    // Image analysis scores
    try {
      const imageStats = await this.analyzeImageContent(frame.jpegData);
      
      // Prefer frames with more content (higher entropy/complexity)
      if (imageStats.complexity > 0.6) {
        score += 0.3;
        reasons.push('complex-content');
      }
      
      // Boost score for frames with text-like regions
      if (imageStats.hasTextRegions) {
        score += 0.4;
        reasons.push('text-content');
      }
      
      // Penalize very dark or very bright frames
      if (imageStats.brightness < 0.1 || imageStats.brightness > 0.9) {
        score -= 0.2;
        reasons.push('poor-lighting');
      }
      
    } catch (error) {
      console.warn(`⚠️ Image analysis failed for frame ${frame.id}:`, error);
      // Don't penalize, just skip image-based scoring
    }

    // Question relevance heuristics
    const lowerQuestion = question.toLowerCase();
    
    // Time-based keywords
    if (lowerQuestion.includes('current') || lowerQuestion.includes('now') || lowerQuestion.includes('see')) {
      if (recencyScore > 0.8) {
        score += 0.3;
        reasons.push('current-context');
      }
    }
    
    // Reading-related keywords
    if (lowerQuestion.includes('read') || lowerQuestion.includes('text') || lowerQuestion.includes('article')) {
      // This would benefit from OCR/text detection, but we're using vision models directly
      score += 0.2;
      reasons.push('reading-related');
    }
    
    // Comparison keywords
    if (lowerQuestion.includes('compare') || lowerQuestion.includes('difference') || lowerQuestion.includes('between')) {
      // For comparison questions, we want diverse frames
      score += 0.1;
      reasons.push('comparison-context');
    }

    return {
      frame,
      score: Math.min(1, Math.max(0, score)), // Clamp between 0 and 1
      reasons
    };
  }

  /**
   * Analyze image content for complexity, brightness, etc.
   */
  private async analyzeImageContent(jpegData: Buffer): Promise<{
    complexity: number;
    brightness: number;
    hasTextRegions: boolean;
  }> {
    try {
      const image = sharp(jpegData);
      const { width, height } = await image.metadata();
      
      if (!width || !height) {
        throw new Error('Invalid image dimensions');
      }

      // Get image statistics
      const stats = await image.stats();
      
      // Calculate complexity based on standard deviation of pixel values
      // Higher std dev = more complex image
      const avgStdDev = stats.channels.reduce((sum, channel) => sum + channel.stdev, 0) / stats.channels.length;
      const complexity = Math.min(1, avgStdDev / 50); // Normalize to 0-1 range
      
      // Calculate brightness from mean values
      const avgMean = stats.channels.reduce((sum, channel) => sum + channel.mean, 0) / stats.channels.length;
      const brightness = avgMean / 255; // Normalize to 0-1 range
      
      // Simple heuristic for text regions - look for high contrast areas
      // Text typically has sharp edges and high local contrast
      const hasTextRegions = avgStdDev > 30 && brightness > 0.2 && brightness < 0.8;
      
      return {
        complexity,
        brightness,
        hasTextRegions
      };
      
    } catch (error) {
      // Fallback values if image analysis fails
      console.warn('Image analysis fallback for frame analysis');
      return {
        complexity: 0.5,
        brightness: 0.5,
        hasTextRegions: false
      };
    }
  }

  /**
   * Get a summary of frame selection for debugging
   */
  getSelectionSummary(originalCount: number, selectedCount: number, question: string): string {
    return `Selected ${selectedCount}/${originalCount} frames for question: "${question.substring(0, 50)}..."`;
  }
}