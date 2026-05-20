import { OpenRouterService } from './openrouter.service.ts';
import {
  ChatCompletionOptions,
  ChatMessage,
} from '../../openrouter/interfaces/openrouter.interface.ts';
import { PromptConfig } from '../../openrouter/interfaces/financialagent.interface.ts';

export class FinancialAgentService {
  constructor(public openRouterService: OpenRouterService) {}

  async queryChat(promptConfig: PromptConfig): Promise<string> {
    const response = await Promise.race([
      this.openRouterService.chat(
        this.getPrompt(promptConfig),
        'openrouter/free',
        'You are a helpful financial consultant assistant.',
      ),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('OpenRouter request timed out after 300 s')), 300_000),
      ),
    ]);
    console.log('Response:', response.length);
    return response;
  }

  getPrompt(promptConfig: PromptConfig): string {
    const textLength = promptConfig.maxTextLength || 500;
    const ideaWords = promptConfig.ideaWordsLength || 100;
    const riskReminder = promptConfig.riskReminder || 5;
    const tradeIdeas = promptConfig.tradeIdeas || '1-5';
    const language = promptConfig.language || 'native english';

    return `You are an elite financial analyst. You will be given three separate JSON data sources: FinancialJuice (US macro/live news) "${promptConfig.financialJuiceContent}", Yahoo Finance (equity news) "${promptConfig.yahooFinanceContent}", and CoinMarketCap (real-time crypto prices, 24h changes, volume, market cap) "${promptConfig.coinmarketCapContent}". 
Synthesize the incoming data and output ONLY markdown. The entire response must be plain text under ${textLength} words.
## Overall Market Stance
State the short-term directional bias for US equities (e.g., cautiously bearish/defensive, favoring specific sectors) and for crypto (e.g., neutral with a bullish BTC tilt, selective alt momentum). Attribute the stance to the single biggest macro or news driver from the provided data.
## High-Conviction Tactical Ideas
Name exactly ${tradeIdeas} trade ideas (stock ticker or crypto symbol) with entry, target, and stop logic, presented in a markdown table with columns: Ticker, Entry, Target, Stop, Thesis. Keep each thesis under ${ideaWords} words.
## Risk & Percentage Impact
Based solely on the provided news and CoinMarketCap price data (never using internal knowledge), estimate: for the US stock market, potential upside percentage and downside percentage with the ticker(s) most impacted; for crypto, potential upside percentage and downside percentage with the crypto ticker(s) most impacted. Compare the news sentiment with the latest CoinMarketCap price action to justify the estimates. Use only the actual CoinMarketCap price and 24h change from the input data for any price references. Present figures in a markdown table with columns: Asset Class, Ticker, Upside %, Downside %. End with a ${riskReminder}-word risk reminder.
 ## USD IDR Currency Impact
Based solely on the provided FinancialJuice and Yahoo Finance data, analyze USD IDR currency impact or potentially impact and state whether it is good news or bad news for the IDR currency. Never use internal knowledge.
## XAU (Gold) Impact
Based solely on the provided FinancialJuice and Yahoo Finance data, analyze the impact on XAU (Gold) or potentially impact and state whether the current data is bullish or bearish for gold. Never use internal knowledge.
Use assertive, ${language} appropriate for a hedge fund morning note.`;
  }
}
