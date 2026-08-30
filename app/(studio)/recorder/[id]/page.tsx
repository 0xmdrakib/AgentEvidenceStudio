'use client';
import { useParams } from 'next/navigation';
import { RunDetail } from '@/components/run-detail';
export default function RunDetailPage() { const params = useParams<{ id: string }>(); return <RunDetail id={params.id} />; }
