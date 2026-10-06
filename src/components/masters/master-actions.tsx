'use client';

import { Download, Upload } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/hooks/use-permission';

/**
 * The occupancy and pincode masters are edited in Excel: download the active version, change it,
 * and upload it as the next version (Admins). Shown on the Occupancy and Pincodes pages; children
 * (an Add button) show to Admins only.
 */
export function MasterActions({ children }: { children?: ReactNode }) {
  const canManage = usePermission('masters.manage');
  return (
    <>
      {canManage ? children : null}
      <Button asChild variant="outline">
        <a href="/api/proxy/masters/workbook" download>
          <Download aria-hidden="true" />
          Download as Excel
        </a>
      </Button>
      {canManage ? (
        <Button asChild>
          <Link href="/masters/import?type=masters">
            <Upload aria-hidden="true" />
            Upload new version
          </Link>
        </Button>
      ) : null}
    </>
  );
}
