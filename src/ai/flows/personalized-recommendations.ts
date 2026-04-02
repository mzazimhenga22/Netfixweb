'use server';
/**
 * @fileOverview An AI agent that provides personalized content recommendations.
 *
 * - personalizeContentRecommendations - A function that handles the content recommendation process.
 * - PersonalizedRecommendationsInput - The input type for the personalizeContentRecommendations function.
 * - PersonalizedRecommendationsOutput - The return type for the personalizeContentRecommendations function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const PersonalizedRecommendationsInputSchema = z.object({
  preferences: z
    .string()
    .describe(
      "A brief description of the user's content preferences (e.g., 'I like sci-fi with plot twists') or a request for trending content."
    ),
});
export type PersonalizedRecommendationsInput = z.infer<
  typeof PersonalizedRecommendationsInputSchema
>;

const PersonalizedRecommendationsOutputSchema = z.object({
  recommendations: z.array(
    z.object({
      title: z.string().describe('The title of the recommended movie or TV show.'),
      genre: z.string().describe('The primary genre of the recommended content.'),
      synopsis: z.string().describe('A brief summary of the recommended content.'),
    })
  ),
});
export type PersonalizedRecommendationsOutput = z.infer<
  typeof PersonalizedRecommendationsOutputSchema
>;

export async function personalizeContentRecommendations(
  input: PersonalizedRecommendationsInput
): Promise<PersonalizedRecommendationsOutput> {
  return personalizedRecommendationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'personalizedRecommendationsPrompt',
  input: { schema: PersonalizedRecommendationsInputSchema },
  output: { schema: PersonalizedRecommendationsOutputSchema },
  prompt: `You are a sophisticated content recommendation AI for a streaming service called Netflix. Your task is to suggest movies or TV shows based on user preferences or by identifying currently trending content if no specific preferences are given.

Provide 5 recommendations that fit the user's preferences. If the preferences are vague or suggest trending content, infer popular and critically acclaimed titles.

User Preferences: {{{preferences}}}

Ensure the output is in the specified JSON format.`,
});

const personalizedRecommendationsFlow = ai.defineFlow(
  {
    name: 'personalizedRecommendationsFlow',
    inputSchema: PersonalizedRecommendationsInputSchema,
    outputSchema: PersonalizedRecommendationsOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);
