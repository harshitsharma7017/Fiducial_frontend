'use client';

import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { CatalogTable, CatalogWorkbookActions } from '@/components/catalog/catalog-view';
import { PageHeader } from '@/components/page-header';
import { SumInsuredInput } from '@/components/rating/sum-insured-input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { catalogQuery } from '@/lib/api/catalog';
import { formatRupeesShort, productRangeText, suggestProducts } from '@/shared';

/** M-4: the products with their sum insured ranges, and what a sum insured suggests. */
export function ProductsView() {
  const inputId = useId();
  const [sumInsured, setSumInsured] = useState('');
  const products = useQuery(catalogQuery('products'));
  const suggested =
    products.data && /^\d+$/.test(sumInsured) && sumInsured !== '0'
      ? suggestProducts(products.data, sumInsured)
      : null;

  return (
    <>
      <PageHeader
        title="Policies"
        description="The policies a proposal can be placed under. A proposal suggests the active policies whose range holds its Fire sum insured; change a range here and the suggestion follows."
        actions={<CatalogWorkbookActions />}
      />
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Try a sum insured</CardTitle>
          <CardDescription>See which policies the current ranges suggest.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[minmax(0,18rem)_1fr] sm:items-end">
          <div className="grid gap-2">
            <Label htmlFor={inputId}>Total Fire sum insured</Label>
            <SumInsuredInput
              id={inputId}
              value={sumInsured}
              onValueChange={(value) => setSumInsured(value.split('.')[0] ?? '')}
            />
          </div>
          <p className="text-sm" aria-live="polite">
            {suggested === null ? (
              <span className="text-muted-foreground">Enter an amount.</span>
            ) : suggested.length === 0 ? (
              <span className="text-warning">
                No active policy covers {formatRupeesShort(sumInsured)}.
              </span>
            ) : (
              <>
                <span className="text-muted-foreground">{formatRupeesShort(sumInsured)}: </span>
                {suggested.map((product, index) => (
                  <span key={product.id}>
                    {index > 0 ? ' or ' : null}
                    <span className="font-medium">{product.name}</span>{' '}
                    <span className="text-muted-foreground">({productRangeText(product)})</span>
                  </span>
                ))}
              </>
            )}
          </p>
        </CardContent>
      </Card>
      <CatalogTable master="products" />
    </>
  );
}
