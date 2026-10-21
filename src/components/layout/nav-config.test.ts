import { describe, expect, it } from 'vitest';
import { can, type Role } from '@/shared';
import { NAV_GROUPS, isOpenToEveryRole, pagePermission, visibleGroups } from './nav-config';

const labels = (roles: readonly Role[] | undefined) =>
  visibleGroups(roles).flatMap((group) => group.items.map((item) => item.label));

// Requirement 2.1 changes the navigation: Group Health becomes GMC under Employee Benefits,
// beside GPA and GTLI, and the Masters gain Family plans (N2) and Age bands (N4).
const PROPOSALS_AND_MASTERS = [
  'Dashboard',
  'Proposals',
  'GMC (Group Health)',
  'GPA (Personal Accident)',
  'GTLI (Term Life)',
  'RFQ',
  'Quotes and QCR',
  'Placement Slips',
];
const MASTERS = [
  'Clients',
  'Insurers',
  'Occupancy',
  'Pincodes',
  'Policies',
  'Coverage sections',
  'Add-on Covers',
  'Tax rates',
  'Standard notes',
  'Occupancy cover defaults',
  'Document templates',
  'Email templates',
  'Clauses',
  'Family plans',
  'Age bands',
];
// Claims follow Proposals for every role but Read-only (claims hold medical information).
const WITH_CLAIMS = PROPOSALS_AND_MASTERS.toSpliced(
  PROPOSALS_AND_MASTERS.indexOf('Proposals') + 1,
  0,
  'Claims',
);
const WORKING_ROLE = [...WITH_CLAIMS, ...MASTERS];
const VIEW_ONLY = [...PROPOSALS_AND_MASTERS, ...MASTERS];
// Import data needs clients.manage: Admins and Relationship Managers.
const MASTERS_WITH_IMPORT = MASTERS.toSpliced(
  MASTERS.indexOf('Email templates') + 1,
  0,
  'Import data',
);
const CLIENT_OWNER = [...WITH_CLAIMS, ...MASTERS_WITH_IMPORT];

describe('visibleGroups', () => {
  it.each<[Role, string[]]>([
    ['ADMIN', [...CLIENT_OWNER, 'Users', 'Audit log', 'Settings']],
    ['MANAGER', WORKING_ROLE],
    ['ACCOUNT_MANAGER', CLIENT_OWNER],
    ['PLACEMENT_EXEC', WORKING_ROLE],
    ['READ_ONLY', VIEW_ONLY],
  ])('shows %s only the screens its permissions allow', (role, expected) => {
    expect(labels([role])).toEqual(expected);
  });

  it('drops a group with nothing left to show', () => {
    expect(visibleGroups(['READ_ONLY']).map((group) => group.title)).toEqual([
      'Overview',
      'Employee Benefits',
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
    ['/ghi', 'proposals.view'],
    ['/ghi/0123456789abcdef01234567', 'proposals.view'],
    ['/ghi/new', 'proposals.create'],
    ['/eb/gpa', 'proposals.view'],
    ['/eb/gtli/0123456789abcdef01234567', 'proposals.view'],
    ['/masters/family-plans', 'masters.view'],
    ['/masters/family-plans/0123456789abcdef01234567', 'masters.view'],
    ['/masters/age-bands', 'masters.view'],
    ['/claims', 'claims.view'],
    ['/claims/0123456789abcdef01234567', 'claims.view'],
    ['/claims/new', 'claims.process'],
    ['/claims/links', 'claims.process'],
    ['/claims/settings', 'claims.admin'],
    ['/rfq', 'proposals.view'],
    ['/masters/occupancy', 'masters.view'],
    ['/masters/clients', 'clients.view'],
    ['/masters/clients/0123456789abcdef01234567', 'clients.view'],
    ['/masters/insurers', 'masters.view'],
    ['/masters/import', 'clients.manage'],
    ['/masters/products', 'masters.view'],
    ['/masters/addons', 'masters.view'],
    ['/masters/tax-rates', 'masters.view'],
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
    expect(isOpenToEveryRole('clients.manage')).toBe(false);
    expect(can(['READ_ONLY'], 'clients.manage')).toBe(false);
  });
});
