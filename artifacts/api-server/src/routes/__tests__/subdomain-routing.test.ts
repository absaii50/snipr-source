/**
 * Subdomain Routing Tests
 * Tests for multi-domain and subdomain support feature
 *
 * @group routing
 * @group subdomains
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

// Mock types - replace with actual types from your codebase
type TestApp = any;
type TestDatabase = any;

describe('Subdomain Routing Feature', () => {
  let app: TestApp;
  let db: TestDatabase;
  let adminToken: string;
  let userToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    // Setup test environment
    // This would be configured based on your actual app setup
    app = setupTestApp();
    db = setupTestDatabase();

    // Create test user and workspace
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword123'
      });

    userToken = loginRes.body.auth_token;
    workspaceId = loginRes.body.workspaceId;
  });

  afterAll(async () => {
    // Cleanup
    await db.cleanup();
  });

  describe('Domain Creation with Subdomain Support', () => {
    it('should create a regular domain without subdomain support', async () => {
      const res = await request(app)
        .post('/api/domains')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          domain: 'example.com',
          supportsSubdomains: false
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.domain).toBe('example.com');
      expect(res.body.supportsSubdomains).toBe(false);
      expect(res.body.verified).toBe(false);
    });

    it('should create a parent domain with subdomain support', async () => {
      const res = await request(app)
        .post('/api/domains')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          domain: 'api.example.com',
          supportsSubdomains: true
        });

      expect(res.status).toBe(201);
      expect(res.body.domain).toBe('api.example.com');
      expect(res.body.supportsSubdomains).toBe(true);
      expect(res.body.isParentDomain).toBe(true);
    });

    it('should reject duplicate domains', async () => {
      // Create first domain
      await request(app)
        .post('/api/domains')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ domain: 'duplicate.com' });

      // Try to create duplicate
      const res = await request(app)
        .post('/api/domains')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ domain: 'duplicate.com' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Conflict');
    });

    it('should normalize domain input', async () => {
      const res = await request(app)
        .post('/api/domains')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          domain: 'https://Example.COM/path'  // Should normalize
        });

      expect(res.status).toBe(201);
      expect(res.body.domain).toBe('example.com');  // Lowercased, no protocol/path
    });
  });

  describe('Link Creation with Domain Binding', () => {
    let parentDomainId: string;
    let subdomainDomainId: string;

    beforeAll(async () => {
      // Create test domains
      const parentRes = await request(app)
        .post('/api/domains')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ domain: 'test-parent.com', supportsSubdomains: true });
      parentDomainId = parentRes.body.id;

      const subRes = await request(app)
        .post('/api/domains')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ domain: 'test-sub.com' });
      subdomainDomainId = subRes.body.id;
    });

    it('should create link on default domain (backward compatibility)', async () => {
      const res = await request(app)
        .post('/api/links')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          slug: 'default-link',
          destinationUrl: 'https://example.com'
        });

      expect(res.status).toBe(201);
      expect(res.body.slug).toBe('default-link');
      expect(res.body.domainId).toBeNull();  // No specific domain
    });

    it('should create link on specific domain', async () => {
      const res = await request(app)
        .post('/api/links')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          slug: 'domain-specific',
          destinationUrl: 'https://example.com',
          domainId: parentDomainId
        });

      expect(res.status).toBe(201);
      expect(res.body.domainId).toBe(parentDomainId);
    });

    it('should reject unverified domain in link creation', async () => {
      const res = await request(app)
        .post('/api/links')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          slug: 'verified-test',
          destinationUrl: 'https://example.com',
          domainId: 'invalid-or-unverified-domain-id'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid or unverified domain');
    });

    it('should allow same slug on different domains', async () => {
      // Create on parent domain
      const res1 = await request(app)
        .post('/api/links')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          slug: 'shared-slug',
          destinationUrl: 'https://parent.example.com',
          domainId: parentDomainId
        });

      expect(res1.status).toBe(201);

      // Create same slug on different domain - should succeed
      const res2 = await request(app)
        .post('/api/links')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          slug: 'shared-slug',
          destinationUrl: 'https://sub.example.com',
          domainId: subdomainDomainId
        });

      expect(res2.status).toBe(201);
      expect(res2.body.domainId).toBe(subdomainDomainId);
    });

    it('should reject duplicate slug on same domain', async () => {
      // Create first link
      await request(app)
        .post('/api/links')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          slug: 'unique-slug',
          destinationUrl: 'https://example.com',
          domainId: parentDomainId
        });

      // Try duplicate on same domain
      const res = await request(app)
        .post('/api/links')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          slug: 'unique-slug',
          destinationUrl: 'https://other.com',
          domainId: parentDomainId
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Slug already taken');
    });
  });

  describe('Link Update with Domain Changes', () => {
    let domainId1: string;
    let domainId2: string;
    let linkId: string;

    beforeAll(async () => {
      // Create domains
      const d1 = await request(app)
        .post('/api/domains')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ domain: 'domain1.com' });
      domainId1 = d1.body.id;

      const d2 = await request(app)
        .post('/api/domains')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ domain: 'domain2.com' });
      domainId2 = d2.body.id;

      // Create link
      const link = await request(app)
        .post('/api/links')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          slug: 'movable-link',
          destinationUrl: 'https://example.com',
          domainId: domainId1
        });
      linkId = link.body.id;
    });

    it('should allow changing link domain', async () => {
      const res = await request(app)
        .put(`/api/links/${linkId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          domainId: domainId2
        });

      expect(res.status).toBe(200);
      expect(res.body.domainId).toBe(domainId2);
    });

    it('should allow changing slug on updated domain', async () => {
      // Link is now on domainId2
      const res = await request(app)
        .put(`/api/links/${linkId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          slug: 'new-slug'
        });

      expect(res.status).toBe(200);
      expect(res.body.slug).toBe('new-slug');
    });
  });

  describe('Subdomain Extraction Logic', () => {
    it('should extract subdomain from host correctly', () => {
      const testCases = [
        { host: 'example.com', expect: { subdomain: null, domain: 'example.com' } },
        { host: 'go.example.com', expect: { subdomain: 'go', domain: 'example.com' } },
        { host: 'api.v2.example.com', expect: { subdomain: 'api.v2', domain: 'example.com' } },
        { host: 'localhost', expect: { subdomain: null, domain: 'localhost' } },
      ];

      testCases.forEach(({ host, expect: expected }) => {
        const result = extractSubdomainAndDomain(host);
        expect(result).toEqual(expected);
      });
    });
  });

  describe('Redirect Routing with Subdomains', () => {
    let verifiedDomainId: string;

    beforeAll(async () => {
      // Create and verify a domain (mock verification)
      const domRes = await request(app)
        .post('/api/domains')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ domain: 'redirect-test.com' });
      verifiedDomainId = domRes.body.id;

      // Mock domain verification in database
      await db.query(
        'UPDATE domains SET verified = true WHERE id = ?',
        [verifiedDomainId]
      );

      // Create test links
      await request(app)
        .post('/api/links')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          slug: 'target',
          destinationUrl: 'https://target.example.com',
          domainId: verifiedDomainId
        });
    });

    it('should redirect from exact domain match', async () => {
      const res = await request(app)
        .get('/r/target')
        .set('Host', 'redirect-test.com');

      expect(res.status).toBe(301);
      expect(res.headers.location).toBe('https://target.example.com');
    });

    it('should return 404 for non-existent slug', async () => {
      const res = await request(app)
        .get('/r/nonexistent')
        .set('Host', 'redirect-test.com');

      expect(res.status).toBe(404);
    });
  });

  describe('Admin Domain Management', () => {
    it('should list all domains with subdomain info', async () => {
      const res = await request(app)
        .get('/api/admin/domains')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      // Check that response includes new fields
      res.body.forEach((domain: any) => {
        expect(domain).toHaveProperty('supportsSubdomains');
        expect(domain).toHaveProperty('isParentDomain');
        expect(domain).toHaveProperty('verified');
      });
    });

    it('should update domain subdomain settings', async () => {
      // First get a domain
      const domainsRes = await request(app)
        .get('/api/admin/domains')
        .set('Authorization', `Bearer ${adminToken}`);
      const domainId = domainsRes.body[0]?.id;

      if (!domainId) return; // Skip if no domains

      const res = await request(app)
        .patch(`/api/domains/${domainId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          supportsSubdomains: true
        });

      expect(res.status).toBe(200);
      expect(res.body.supportsSubdomains).toBe(true);
    });
  });

  describe('Cache Layer with Domains', () => {
    it('should cache links separately by domain', async () => {
      // This test verifies cache key includes domain
      // Implementation depends on how caching is tested in your codebase

      // Create two domains with same slug
      const d1 = await request(app)
        .post('/api/domains')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ domain: 'cache1.com' });

      const d2 = await request(app)
        .post('/api/domains')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ domain: 'cache2.com' });

      // Create same slug on both
      await request(app)
        .post('/api/links')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          slug: 'cached',
          destinationUrl: 'https://url1.com',
          domainId: d1.body.id
        });

      await request(app)
        .post('/api/links')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          slug: 'cached',
          destinationUrl: 'https://url2.com',
          domainId: d2.body.id
        });

      // Both should be retrievable without conflict
      const links = await request(app)
        .get('/api/links')
        .set('Authorization', `Bearer ${userToken}`);

      const cachedLinks = links.body.filter((l: any) => l.slug === 'cached');
      expect(cachedLinks.length).toBe(2);
    });
  });
});

// Helper function (would be imported in real test)
function extractSubdomainAndDomain(host: string) {
  const parts = host.split('.');
  if (parts.length < 2) {
    return { subdomain: null, domain: host };
  }
  const domain = parts.slice(-2).join('.');
  const subdomain = parts.slice(0, -2).join('.') || null;
  return { subdomain, domain };
}

// Mock setup functions (would be real in actual test)
function setupTestApp() {
  // Return actual Express app instance
  return null;
}

function setupTestDatabase() {
  // Return actual database connection
  return null;
}
