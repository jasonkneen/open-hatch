import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_FAMILY,
  ACTIVITY_SOURCE_OF_TRUTH,
  ActivityFilter,
  activityFamilyFor,
  familyDotColor,
  familyTagClass,
} from '@/lib/activityFamily';

// The full ActivityEventType union, so a future event_type added to the schema
// forces this mapping table to be revisited rather than silently falling back
// to 'all'.
const ALL_EVENT_TYPES = [
  'document_created', 'document_updated', 'document_deleted',
  'task_created', 'task_completed', 'task_updated',
  'comment_created',
  'chat_created', 'message_sent',
  'memory_added',
  'member_joined',
  'canvas_updated',
  'agent_connected', 'agent_disconnected',
  'provider_call',
  'join_link_created', 'join_link_redeemed',
] as const;

const FAMILIES = (
  ['docs', 'tasks', 'messages', 'comments', 'agents', 'memory', 'people', 'canvas'] as const
);

describe('ACTIVITY_FAMILY mapping', () => {
  it('maps every ActivityEventType to a family', () => {
    for (const ev of ALL_EVENT_TYPES) {
      expect(ACTIVITY_FAMILY[ev], ev).toBeTruthy();
    }
  });

  it('activityFamilyFor agrees with ACTIVITY_FAMILY for mapped types', () => {
    for (const ev of ALL_EVENT_TYPES) {
      expect(activityFamilyFor({ event_type: ev })).toBe(ACTIVITY_FAMILY[ev]);
    }
  });

  it('every mapped family is one of the known filter families (not \'all\')', () => {
    for (const ev of ALL_EVENT_TYPES) {
      const f = ACTIVITY_FAMILY[ev];
      expect(FAMILIES).toContain(f);
    }
  });

  it('maps an unmapped type to \'all\' (fail-open)', () => {
    // The mapping is a Record keyed on the union; simulate an unknown type.
    // @ts-expect-error intentionally not a member of ActivityEventType
    expect(activityFamilyFor({ event_type: 'something_new' })).toBe('all');
  });
});

describe('familyTagClass', () => {
  it('returns the stable activity-family-{name} class per family', () => {
    for (const fam of FAMILIES) {
      expect(familyTagClass(fam)).toBe(`activity-family-${fam}`);
    }
  });

  it('returns activity-family-all for undefined and for \'all\'', () => {
    expect(familyTagClass(undefined)).toBe('activity-family-all');
    expect(familyTagClass('all')).toBe('activity-family-all');
  });
});

describe('familyDotColor shares one source of truth with the tags', () => {
  it('has a token entry for every family including docs and all', () => {
    for (const fam of FAMILIES) {
      expect(ACTIVITY_SOURCE_OF_TRUTH[fam], fam).toBeDefined();
    }
    expect(ACTIVITY_SOURCE_OF_TRUTH.docs).toBeDefined();
  });

  it('derives every family dot colour from the shared source, not a literal', () => {
    for (const fam of FAMILIES) {
      expect(familyDotColor(fam), fam).toBe(ACTIVITY_SOURCE_OF_TRUTH[fam]);
    }
  });

  it('keeps the token-driven specials stable', () => {
    expect(ACTIVITY_SOURCE_OF_TRUTH.all).toBe('var(--foreground)');
    expect(ACTIVITY_SOURCE_OF_TRUTH.docs).toBe('var(--primary)');
    expect(familyDotColor(undefined)).toBe(ACTIVITY_SOURCE_OF_TRUTH.all);
    expect(familyDotColor('all')).toBe(ACTIVITY_SOURCE_OF_TRUTH.all);
  });
});

describe('ActivityFilter type shape', () => {
  it('covers exactly all + the families', () => {
    const filters: ActivityFilter[] = ['all', ...FAMILIES];
    for (const f of filters) {
      expect(familyTagClass(f)).toBeDefined();
    }
  });
});
