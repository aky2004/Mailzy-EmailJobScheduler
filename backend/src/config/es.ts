import { Client } from '@elastic/elasticsearch';

const ES_NODE = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

export const esClient = new Client({
  node: ES_NODE,
});

export const ES_INDEX = 'email_jobs';

export async function initElasticsearch() {
  try {
    const indexExists = await esClient.indices.exists({ index: ES_INDEX });
    if (!indexExists) {
      // ES v8 SDK: mappings go directly as top-level params, no 'body' wrapper
      await esClient.indices.create({
        index: ES_INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            campaignId: { type: 'keyword' },
            userId: { type: 'keyword' },
            subject: { type: 'text' },
            body: { type: 'text' },
            recipientEmail: { type: 'keyword' },
            senderEmail: { type: 'keyword' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
          },
        },
      });
      console.log(`✅ Elasticsearch index '${ES_INDEX}' created.`);
    } else {
      console.log(`✅ Elasticsearch index '${ES_INDEX}' already exists.`);
    }
  } catch (error) {
    console.error('❌ Failed to initialize Elasticsearch:', error);
  }
}
