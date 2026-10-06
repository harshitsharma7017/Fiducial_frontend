import { describe, expect, it } from 'vitest';
import { can, type Role } from '@/shared';
import { NAV_GROUPS, isOpenToEveryRole, pagePermission, visibleGroups } from './nav-config';

const labels = (roles: readonly Role[] | undefined) =>
  visibleGroups(roles).flatMap((group) => group.items.map((item) => item.label));

const PROPOSALS_AND_MASTERS = [
  'Dashboard',
  'New Proposals',
  'Existing Proposals',
  'RFQ',
  'Quotes and QCR',
  'Placement Slips',
];
const MASTERS = ['Occupancy', 'Pincodes', 'Add-on Covers', 'Clauses', 'Insurers'];
const WORKING_ROLE = [...PROPOSALS_AND_MASTERS, 'Fire rate check', ...MASTERS];
const VIEW_ONLY = [...PROPOSALS_AND_MASTERS, ...MASTERS];

describe('visibleGroups', () => {
  it.each<[Role, string[]]>([
    ['ADMIN', [...WORKING_ROLE, 'Users', 'Audit log', 'Settings']],
    ['MANAGER', WORKING_ROLE],
    ['ACCOUNT_MANAGER', WORKING_ROLE],
    ['PLACEMENT_EXEC', WORKING_ROLE],
    ['READ_ONLY', VIEW_ONLY],
  ])('shows %s only the screens its permissions allow', (role, expected) => {
    expect(labels([role])).toEqual(expected);
  });

  it('drops a group with nothing left to show', () => {
    expect(visibleGroups(['READ_ONLY']).map((group) => group.title)).toEqual([
      'Overview',
      'Proposals',
      'Workflow',
      'Masters',
    ]);
  });

  it('shows only what every role may see while the user loads', () => {
    expect(labels(undefined)).toEqual(VIEW_ONLY);
  });

  it('combines the screens of several roles', () => {
    expect(labels(['READ_ONLY', 'PLACEMENT_EXEC'])).toEqual(WORKING_ROLE);
  });
});

describe('pagePermission', () => {
  it.each([
    ['/dashboard', 'proposals.view'],
    ['/proposals', 'proposals.view'],
    ['/proposals/prp-0101', 'proposals.view'],
    ['/proposals/new', 'proposals.create'],
    ['/masters/occupancy', 'masters.view'],
    ['/rating/fire', 'rating.use'],
    ['/users', 'users.manage'],
    ['/audit', 'audit.view'],
    ['/settings', 'settings.view'],
  ])('%s needs %s', (pathname, permission) => {
    expect(pagePermission(pathname)).toBe(permission);
  });

  it('needs nothing for pages open to every signed-in user', () => {
    expect(pagePermission('/profile')).toBeNull();
    // A shared prefix is not a parent path.
    expect(pagePermission('/usersettings')).toBeNull();
  });

  it('matches each nav link to its own permission', () => {
    for (const item of NAV_GROUPS.flatMap((group) => group.items)) {
      if (!item.href || item.planned) continue;
      expect(pagePermission(item.href.split('?')[0] ?? item.href)).toBe(item.permission);
    }
  });
});

describe('isOpenToEveryRole', () => {
  it('is true only when every role holds the permission', () => {
    expect(isOpenToEveryRole('proposals.view')).toBe(true);
    expect(isOpenToEveryRole('masters.view')).toBe(true);
    expect(isOpenToEveryRole('rating.use')).toBe(false);
    expect(can(['READ_ONLY'], 'rating.use')).toBe(false);
  });
});
