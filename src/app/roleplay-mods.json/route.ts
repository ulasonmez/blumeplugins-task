import { NextResponse } from 'next/server';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const dynamic = 'force-static';

export async function GET() {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=30, s-maxage=30'
  };

  try {
    const q = query(collection(db, 'roleplayMods'), orderBy('order', 'asc'));
    const snapshot = await getDocs(q);
    
    const videos = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        title: data.title || '',
        videoUrl: data.videoUrl || '',
        version: data.version || '',
        badge: data.badge || ''
      };
    });

    return NextResponse.json({ videos }, { headers });
  } catch (error) {
    console.error('Error generating roleplay mods JSON:', error);
    // A database/read error must fail generation rather than caching an empty list.
    throw error;
  }
}
