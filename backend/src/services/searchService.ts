import { Client } from '@elastic/elasticsearch';
import { prisma } from '../config/db';
import dotenv from 'dotenv';

dotenv.config();

export interface EmailDocument {
  id: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date | string;
  sentAt?: Date | string | null;
  etherealPreviewUrl?: string | null;
  createdAt: Date | string;
}

export interface SearchQueryOptions {
  userId: string;
  query: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface SearchResultItem {
  id: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  etherealPreviewUrl?: string | null;
  createdAt: string;
  highlight?: {
    subject?: string[];
    body?: string[];
    recipientEmail?: string[];
  };
  score?: number;
}

export interface SearchResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  engine: 'elasticsearch' | 'database_fallback';
  items: SearchResultItem[];
}

class SearchService {
  private client: Client;
  private readonly indexName = 'reachinbox_emails';
  private isEsAvailable = false;

  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
      maxRetries: 2,
      requestTimeout: 3000,
    });

    this.checkHealthAndInit();
  }

  private async checkHealthAndInit() {
    try {
      const ping = await this.client.ping();
      if (ping) {
        this.isEsAvailable = true;
        console.log('✅ Connected to Elasticsearch cluster successfully');
        await this.createIndexIfNotExists();
      }
    } catch (err) {
      this.isEsAvailable = false;
      console.log('ℹ️ Elasticsearch cluster not running on port 9200. Operating in resilient DB fallback mode.');
    }
  }

  private async createIndexIfNotExists() {
    try {
      const exists = await this.client.indices.exists({ index: this.indexName });
      if (!exists) {
        await this.client.indices.create({
          index: this.indexName,
          body: {
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
              analysis: {
                analyzer: {
                  email_analyzer: {
                    type: 'custom',
                    tokenizer: 'uax_url_email',
                    filter: ['lowercase'],
                  },
                },
              },
            },
            mappings: {
              properties: {
                id: { type: 'keyword' },
                userId: { type: 'keyword' },
                senderEmail: { type: 'keyword' },
                recipientEmail: {
                  type: 'text',
                  analyzer: 'email_analyzer',
                  fields: { keyword: { type: 'keyword' } },
                },
                subject: { type: 'text', analyzer: 'standard' },
                body: { type: 'text', analyzer: 'standard' },
                status: { type: 'keyword' },
                scheduledAt: { type: 'date' },
                sentAt: { type: 'date' },
                etherealPreviewUrl: { type: 'keyword' },
                createdAt: { type: 'date' },
              },
            },
          },
        });
        console.log(`✅ Elasticsearch index '${this.indexName}' created successfully.`);
      }
    } catch (error) {
      console.warn('⚠️ Elasticsearch index verification/creation note:', (error as Error).message);
    }
  }

  public async indexEmail(doc: EmailDocument): Promise<void> {
    if (!this.isEsAvailable) return;

    try {
      await this.client.index({
        index: this.indexName,
        id: doc.id,
        body: {
          ...doc,
          scheduledAt: new Date(doc.scheduledAt).toISOString(),
          sentAt: doc.sentAt ? new Date(doc.sentAt).toISOString() : null,
          createdAt: new Date(doc.createdAt).toISOString(),
        },
      });
      console.log(`🔍 [Elasticsearch] Indexed email: ${doc.id} (${doc.recipientEmail})`);
    } catch (error) {
      console.warn(`⚠️ [Elasticsearch] Failed to index email ${doc.id}:`, (error as Error).message);
    }
  }

  public async searchEmails(options: SearchQueryOptions): Promise<SearchResponse> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 10));
    const offset = (page - 1) * limit;

    // Try Elasticsearch first if available
    if (this.isEsAvailable && options.query.trim()) {
      try {
        const mustClauses: any[] = [{ term: { userId: options.userId } }];

        if (options.query.trim()) {
          mustClauses.push({
            multi_match: {
              query: options.query,
              fields: ['recipientEmail^3', 'subject^2', 'body', 'senderEmail'],
              fuzziness: 'AUTO',
              operator: 'or',
            },
          });
        }

        const filterClauses: any[] = [];
        if (options.status) {
          filterClauses.push({ term: { status: options.status } });
        }

        const result: any = await this.client.search({
          index: this.indexName,
          from: offset,
          size: limit,
          body: {
            query: {
              bool: {
                must: mustClauses,
                filter: filterClauses,
              },
            },
            highlight: {
              pre_tags: ['<mark class="bg-indigo-500/30 text-indigo-300 px-1 rounded">'],
              post_tags: ['</mark>'],
              fields: {
                subject: {},
                body: {},
                recipientEmail: {},
              },
            },
            sort: [{ scheduledAt: { order: 'desc' } }],
          },
        });

        const totalHits = typeof result.hits.total === 'number' ? result.hits.total : result.hits.total?.value || 0;
        const items: SearchResultItem[] = (result.hits.hits || []).map((hit: any) => ({
          ...hit._source,
          score: hit._score,
          highlight: hit.highlight,
        }));

        return {
          total: totalHits,
          page,
          limit,
          totalPages: Math.ceil(totalHits / limit),
          engine: 'elasticsearch',
          items,
        };
      } catch (esErr) {
        console.warn('⚠️ [Elasticsearch] Search query error, falling back to database:', (esErr as Error).message);
      }
    }

    // Fallback: Database full-text search via PostgreSQL
    const where: any = {
      userId: options.userId,
    };

    if (options.status) {
      where.status = options.status;
    }

    if (options.query.trim()) {
      const q = options.query.trim();
      where.OR = [
        { recipientEmail: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
        { senderEmail: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      prisma.scheduledEmail.count({ where }),
      prisma.scheduledEmail.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
      }),
    ]);

    const items: SearchResultItem[] = records.map((r) => ({
      id: r.id,
      userId: r.userId,
      senderEmail: r.senderEmail,
      recipientEmail: r.recipientEmail,
      subject: r.subject,
      body: r.body,
      status: r.status,
      scheduledAt: r.scheduledAt.toISOString(),
      sentAt: r.sentAt?.toISOString() || null,
      etherealPreviewUrl: r.etherealPreviewUrl,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      engine: 'database_fallback',
      items,
    };
  }
}

export const searchService = new SearchService();
