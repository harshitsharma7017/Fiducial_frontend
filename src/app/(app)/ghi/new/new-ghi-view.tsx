'use client';

import { DemoModeGate } from '@/components/demo-mode-gate';
import { LineOfBusinessSwitch } from '@/components/ghi/line-of-business';
import { NewGhiCaseForm } from '@/components/ghi/new-ghi-case-form';
import { PageHeader } from '@/components/page-header';
import { AccessDeniedState } from '@/components/states';
import { usePermission } from '@/hooks/use-permission';

/** Creates a group health case (G1), beside Property's New proposal. */
export function NewGhiView() {
  const canCreate = usePermission('proposals.create');
  return (
    <>
      <PageHeader
        title="New case"
        description="Group health: choose the company, the policy period and who works on it. Then fill the Data Sheet and the employee census."
      />
      <LineOfBusinessSwitch current="GHI" />
      <DemoModeGate>
        {canCreate ? (
          <NewGhiCaseForm />
        ) : (
          <AccessDeniedState description="A Relationship Manager or Admin starts cases." />
        )}
      </DemoModeGate>
    </>
  );
}
