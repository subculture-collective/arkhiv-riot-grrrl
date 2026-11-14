import { useEffect } from 'react';
import { PrintReader, initialPrintPage, type PrintHit } from '@subcult/archive-viewer/print';
import type { Variant } from './App';
import { pdfBackend } from './pdfBackend';

function writePage(page:number){const params=new URLSearchParams(location.search);params.set('page',String(page));history.replaceState(null,'','?'+params);}
// The reader clamps an invalid or out-of-range ?page= to a real page. This returns
// that page when the address says something else, so the address can be corrected.
export function correctedPage(search:string,pages:number){
  const raw=new URLSearchParams(search).get('page');
  if(raw===null)return null;
  const page=initialPrintPage(Number(raw),pages);
  return String(page)===raw?null:page;
}

// Arkhiv owns asset routes, publication checks and document page links.
// Reader controls and cancellation come from the shared package.
export default function Reader({variant,title,initialPage}: {variant:Variant;title:string;initialPage:number}) {
  const id=encodeURIComponent(variant.id);
  const searchable=variant.text_status==='page-text'||variant.text_status==='document-text';
  useEffect(()=>{const page=correctedPage(location.search,variant.pages);if(page!==null)writePage(page);},[initialPage,variant.pages]);
  // An edition without text has nothing for the Search & text panel to show, so the toggle is left out.
  return <PrintReader url={'/api/assets/'+id} title={title}
    initialPage={initialPage} backend={pdfBackend} pageArrows fitPage fullscreen searchToggle={searchable}
    onPageChange={writePage}
    search={searchable ? async (query,signal):Promise<PrintHit[]>=>{
      const response=await fetch('/api/assets/'+id+'/search?'+new URLSearchParams({q:query}),{signal,cache:'no-store'});
      if(!response.ok)throw new Error('Document search unavailable');
      return response.json();
    }:undefined}/>;
}
