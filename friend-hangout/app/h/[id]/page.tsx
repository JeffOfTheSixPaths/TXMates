'use client';

import React, { use, Suspense } from 'react';
import { HangoutWorkspace } from '@/components/HangoutWorkspace';

interface PageProps {
  params: Promise<{ id: string }>;
}

function GroupHangoutInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <HangoutWorkspace hangoutId={id} />;
}

export default function GroupHangoutPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-pine p-8 text-base font-semibold text-ink-soft">
          Loading hangout group workspace...
        </div>
      }
    >
      <GroupHangoutInner params={params} />
    </Suspense>
  );
}
