import { describe, expect, it } from 'vitest';
import { legacyPermissionsOf, type LegacyRole, type Permission } from '@/shared';
import { NAV_GROUPS, allows, pagePermission, visibleGroups } from './nav-config';

const labels = (permissions: readonly Permission[] | undefined) =>
  visibleGroups(permissions).flatMap((group) => group.items.map((item) => item.label));
/** What a user holding these migrated system roles sees (their permissions as /auth/me gives). */
const labelsOf = (roles: readonly LegacyRole[]) => labels(legacyPermissionsOf(roles));

// Property, Fire and Burglary, then Employee Benefits (GMC, GPA, GTLI), group health claims and the
// claims and renewal analyses, then the masters both lines use.
const PROPERTY = ['Dashboard', 'Proposals', 'RFQ', 'Quotes and QCR', 'Placement Slips'];
const BENEFITS = ['GMC (Group Health)', 'GPA (Personal Accident)', 'GTLI (Term Life)'];
// Claims and the claims analysis need claims permissions, so not for Read-only users (claims hold
// medical information); the renewal analysis needs renewal_analysis.view.
const CLAIMS_AND_REPORTS = ['Claims', 'Claims analysis', 'Renewal analysis'];
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
const WORKING_ROLE = [...PROPERTY, ...BENEFITS, ...CLAIMS_AND_REPORTS, ...MASTERS];
const VIEW_ONLY = [...PROPERTY, ...BENEFITS, 'Renewal analysis', ...MASTERS];
// Import data needs an import permission: Admins and Relationship Managers (clients.import).
const MASTERS_WITH_IMPORT = MASTERS.toSpliced(
  MASTERS.indexOf('Email templates') + 1,
  0,
  'Import data',
);
const CLIENT_OWNER = [...PROPERTY, ...BENEFITS, ...CLAIMS_AND_REPORTS, ...MASTERS_WITH_IMPORT];

describe('visibleGroups for the migrated legacy roles (unchanged navigation)', () => {
  it.each<[LegacyRole, string[]]>([
    ['ADMIN', [...CLIENT_OWNER, 'Users', 'Roles', 'Audit log', 'Settings']],
    ['MANAGER', WORKING_ROLE],
    ['ACCOUNT_MANAGER', CLIENT_OWNER],
    ['PLACEMENT_EXEC', WORKING_ROLE],
    ['READ_ONLY', VIEW_ONLY],
  ])('shows %s only the screens its permissions allow', (role, expected) => {
    expect(labelsOf([role])).toEqual(expected);
  });

  it('combines the screens of several roles', () => {
    expect(labelsOf(['READ_ONLY', 'PLACEMENT_EXEC'])).toEqual(WORKING_ROLE);
  });
});

describe('visibleGroups for custom roles', () => {
  it('shows exactly the items the permissions allow, whatever role grants them', () => {
    expect(labels(['catalog.view'])).toEqual([
      'Policies',
      'Coverage sections',
      'Add-on Covers',
      'Tax rates',
      'Standard notes',
      'Occupancy cover defaults',
      'Clauses',
    ]);
    expect(labels(['insurers.import'])).toEqual(['Import data']);
    expect(labels(['roles.view', 'audit.view'])).toEqual(['Roles', 'Audit log']);
  });

  it('keeps products apart: a GPA-only role sees GPA, not GMC or GTLI', () => {
    expect(labels(['gpa.view'])).toEqual(['GPA (Personal Accident)']);
  });

  it('shows a claims handler only the claims screens their role grants', () => {
    expect(labels(['claims.view', 'claims.process'])).toEqual(['Claims']);
    expect(labels(['claims_analysis.view'])).toEqual(['Claims analysis']);
  });

  it('drops a group with nothing left to show', () => {
    expect(visibleGroups(['users.view']).map((group) => group.title)).toEqual(['Admin']);
    expect(visibleGroups([])).toEqual([]);
  });

  it('shows nothing while the user loads: no item is open to every role any more', () => {
    expect(labels(undefined)).toEqual([]);
  });
});

describe('pagePermission', () => {
  it.each<[string, Permission | readonly Permission[]]>([
    ['/dashboard', 'property.view'],
    ['/proposals', 'property.view'],
    ['/proposals/prp-0101', 'property.view'],
    ['/proposals/new', ['property.create', 'gmc.create', 'gpa.create', 'gtli.create']],
    ['/proposals/deleted', 'property.delete'],
    ['/rfq', 'property.view'],
    ['/masters/occupancy', 'masters.view'],
    ['/masters/clients', 'clients.view'],
    ['/masters/clients/0123456789abcdef01234567', 'clients.view'],
    ['/masters/insurers', 'insurers.view'],
    ['/masters/import', ['clients.import', 'insurers.import', 'masters.manage', 'catalog.manage']],
    ['/masters/products', 'catalog.view'],
    ['/masters/addons', 'catalog.view'],
    ['/masters/tax-rates', 'catalog.view'],
    ['/masters/templates', 'templates.view'],
    ['/masters/email-templates', 'email_templates.view'],
    ['/masters/family-plans', 'family_plans.view'],
    ['/masters/family-plans/0123456789abcdef01234567', 'family_plans.view'],
    ['/masters/age-bands', 'age_bands.view'],
    ['/ghi', 'gmc.view'],
    ['/ghi/0123456789abcdef01234567', 'gmc.view'],
    ['/ghi/new', ['gmc.create', 'gpa.create', 'gtli.create']],
    ['/eb/gpa', 'gpa.view'],
    ['/eb/gtli/0123456789abcdef01234567', 'gtli.view'],
    ['/claims', 'claims.view'],
    ['/claims/0123456789abcdef01234567', 'claims.view'],
    ['/claims/new', 'claims.create'],
    ['/claims/links', 'claims.links'],
    ['/claims/settings', 'claims.settings'],
    ['/claims/tpa', 'claims.view'],
    ['/claims/tpa/import', 'claims.tpa_import'],
    ['/claims/tpa/formats', 'claims.tpa_manage'],
    ['/claims-analysis', 'claims_analysis.view'],
    ['/renewal', 'renewal_analysis.view'],
    ['/users', 'users.view'],
    ['/roles', 'roles.view'],
    ['/audit', 'audit.view'],
    ['/settings', 'settings.view'],
  ])('%s needs %j', (pathname, permission) => {
    expect(pagePermission(pathname)).toEqual(permission);
  });

  it('needs nothing for pages open to every signed-in user', () => {
    expect(pagePermission('/profile')).toBeNull();
    // A shared prefix is not a parent path.
    expect(pagePermission('/usersettings')).toBeNull();
  });

  it('matches each nav link to its own permission', () => {
    for (const item of NAV_GROUPS.flatMap((group) => group.items)) {
      if (!item.href || item.planned) continue;
      expect(pagePermission(item.href.split('?')[0] ?? item.href)).toEqual(item.permission);
    }
  });
});

describe('allows', () => {
  it('needs the permission, or any one of a list', () => {
    expect(allows(['property.view'], 'property.view')).toBe(true);
    expect(allows(['property.view'], 'property.edit')).toBe(false);
    expect(allows(['catalog.manage'], ['clients.import', 'catalog.manage'])).toBe(true);
    expect(allows([], ['clients.import'])).toBe(false);
  });
});
