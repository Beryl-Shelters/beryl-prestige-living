"use client";

import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, House, MapPin } from "lucide-react";
import { MarketplaceHeader } from "./marketplace-header";
import { customerApi } from "@/lib/api/client";
import { formatNaira, humanizeMarketplaceValue } from "@/lib/marketplace";

export function SavedPropertiesScreen() {
  const queryClient = useQueryClient();
  const saved = useQuery({ queryKey: ["saved-properties"], queryFn: () => customerApi.savedProperties({ page: 1, limit: 50 }) });
  const unsave = useMutation({
    mutationFn: (propertyId: string) => customerApi.unsaveProperty(propertyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-properties"] })
  });
  const items = saved.data?.data.saved_properties ?? [];

  return <div className="marketplace-page saved-properties-page">
    <MarketplaceHeader returnTo="/saved" />
    <main className="saved-properties-main">
      <header><p className="seller-kicker">Buyer Marketplace</p><h1>Saved Properties</h1><p>Keep your favourite verified properties together.</p></header>
      {saved.isLoading ? <div className="marketplace-grid" aria-label="Loading saved properties" aria-live="polite">{Array.from({ length: 3 }, (_, index) => <div className="marketplace-card-skeleton" key={index}><div /><span /><span /></div>)}</div> : null}
      {saved.isError ? <section className="marketplace-state-card" role="alert"><House size={34} /><h2>We could not load your saved properties</h2><button className="btn btn-primary" type="button" onClick={() => saved.refetch()}>Try again</button></section> : null}
      {!saved.isLoading && !saved.isError && !items.length ? <section className="marketplace-state-card"><Heart size={36} /><h2>No saved properties yet</h2><p>Use the heart on a property to keep it here.</p><Link className="btn btn-primary" href="/marketplace">Browse properties</Link></section> : null}
      {items.length ? <div className="marketplace-grid">{items.map(({ property }) => <article className="marketplace-property-card" key={property.id}>
        <Link className="marketplace-property-image-link" href={`/marketplace/${property.id}`}><div className="marketplace-property-image">{property.coverImage ? <Image src={property.coverImage.url} alt={`${property.title} in ${property.publicLocation}`} fill sizes="(max-width: 767px) 100vw, 33vw" /> : <div className="marketplace-image-placeholder"><House size={38} /><span>Property image unavailable</span></div>}</div></Link>
        <button className="marketplace-card-save" type="button" aria-label={`Remove ${property.title} from saved properties`} disabled={unsave.isPending && unsave.variables === property.id} onClick={() => unsave.mutate(property.id)}><Heart size={19} fill="currentColor" /></button>
        <div className="marketplace-property-body"><strong className="marketplace-card-price">{formatNaira(property.askingPrice)}</strong><Link className="marketplace-card-title" href={`/marketplace/${property.id}`}>{property.title}</Link><div className="marketplace-card-kicker"><span>{humanizeMarketplaceValue(property.propertyType)}</span></div><p className="marketplace-card-location"><MapPin size={16} />{property.publicLocation}</p></div>
      </article>)}</div> : null}
    </main>
  </div>;
}
