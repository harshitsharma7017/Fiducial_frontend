'use client';

import { DemoModeGate } from '@/components/demo-mode-gate';
import { NewCaseChooser } from '@/components/eb/new-case-chooser';
import { PageHeader } from '@/components/page-header';

/** /ghi/new: the new case form with Employee Benefits and GMC chosen (Requirement 2.2). */
export function NewGhiView() {
  return (
    <>
      <PageHeader
        title="New case"
        description="Employee Benefits: choose the product, the company, the policy period and who works on it. Then fill the Data Sheet and the employee census."
      />
      <DemoModeGate>
        <NewCaseChooser initialLine="EB" initialProduct="GMC" />
      </DemoModeGate>
    </>
  );
}
