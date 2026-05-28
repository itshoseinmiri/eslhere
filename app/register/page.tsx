'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function RegisterRedirect() {
  return <Suspense><RegisterContent /></Suspense>;
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const cls = searchParams.get('class') || 'private';
    router.replace('/?class=' + cls);
  }, [router, searchParams]);

  return null;
}
