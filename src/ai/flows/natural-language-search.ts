'use server';
/**
 * @fileOverview A Genkit flow for processing natural language search queries for content discovery.
 *
 * - naturalLanguageContentSearch - A function that handles natural language queries for movies/TV shows.
 * - NaturalLanguageSearchInput - The input type for the naturalLanguageContentSearch function.
 * - NaturalLanguageSearchOutput - The return type for the naturalLanguageContentSearch function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const NaturalLanguageSearchInputSchema = z.object({
  query: z.string().describe('The natural language search query from the user.'),
});
export type NaturalLanguageSearchInput = z.infer<typeof NaturalLanguageSearchInputSchema>;

const NaturalLanguageSearchOutputSchema = z.object({
  genres: z.array(z.string()).optional().describe('An array of genres extracted from the query, e.g., ["sci-fi", "thriller"].'),
  keywords: z.array(z.string()).optional().describe('An array of keywords or themes extracted from the query, e.g., ["space", "aliens"].'),
  era: z.string().optional().describe('A specific era or decade mentioned in the query, e.g., "90s", "2000s".'),
  mood: z.string().optional().describe('The desired mood or tone of the content, e.g., "thrilling", "romantic", "comedy".'),
  type: z.enum(['movie', 'tv-show', 'both']).optional().describe('The type of content requested: "movie", "tv-show", or "both".'),
});
export type NaturalLanguageSearchOutput = z.infer<typeof NaturalLanguageSearchOutputSchema>;

export async function naturalLanguageContentSearch(input: NaturalLanguageSearchInput): Promise<NaturalLanguageSearchOutput> {
  return naturalLanguageContentSearchFlow(input);
}

const naturalLanguageContentSearchPrompt = ai.definePrompt({
  name: 'naturalLanguageContentSearchPrompt',
  input: {schema: NaturalLanguageSearchInputSchema},
  output: {schema: NaturalLanguageSearchOutputSchema},
  prompt: `You are an AI assistant designed to parse natural language queries for a streaming service. Your goal is to extract structured search parameters from the user's query.

Extract the following information:
-   **genres**: A list of genres (e.g., "sci-fi", "thriller").
-   **keywords**: A list of relevant keywords or themes (e.g., "space", "aliens", "detective").
-   **era**: A specific era or decade (e.g., "90s", "2000s").
-   **mood**: The desired mood or tone (e.g., "thrilling", "romantic", "comedy").
-   **type**: The type of content requested ("movie", "tv-show", or "both").

If a piece of information is not explicitly mentioned or clearly implied, omit it from the output. Only return the JSON object.

User query: "{{{query}}}"`,
});

const naturalLanguageContentSearchFlow = ai.defineFlow(
  {
    name: 'naturalLanguageContentSearchFlow',
    inputSchema: NaturalLanguageSearchInputSchema,
    outputSchema: NaturalLanguageSearchOutputSchema,
  },
  async (input) => {
    const {output} = await naturalLanguageContentSearchPrompt(input);
    return output!;
  }
);
