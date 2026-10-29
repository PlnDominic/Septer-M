'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CATEGORIES, PRODUCTS, type Category } from '@/lib/products';
import { useAdmin } from '@/lib/admin/store';
import type { AdminProduct } from '@/lib/admin/types';
import { Card, btnGhost, btnPrimary, inputClass } from './ui';

const IMAGES = PRODUCTS.map((p) => p.image);
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const toMinor = (v: string) => Math.round(parseFloat(v || '0') * 100);
const toMajor = (n?: number) => (n === undefined ? '' : (n / 100).toFixed(2));
const list = (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean);

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function ProductForm({ product }: { product?: AdminProduct }) {
  const router = useRouter();
  const { products, saveProduct, deleteProduct } = useAdmin();
  const editing = !!product;

  const [name, setName] = useState(product?.name ?? '');
  const [tagline, setTagline] = useState(product?.tagline ?? '');
  const [category, setCategory] = useState<Category>(product?.category ?? 'serum');
  const [sizeMl, setSizeMl] = useState(String(product?.sizeMl ?? 30));
  const [gbp, setGbp] = useState(toMajor(product?.price.GBP));
  const [ghs, setGhs] = useState(toMajor(product?.price.GHS));
  const [wasGbp, setWasGbp] = useState(toMajor(product?.compareAt?.GBP));
  const [wasGhs, setWasGhs] = useState(toMajor(product?.compareAt?.GHS));
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [status, setStatus] = useState<AdminProduct['status']>(product?.status ?? 'draft');
  const [skinTypes, setSkinTypes] = useState(product?.skinTypes.join(', ') ?? '');
  const [concerns, setConcerns] = useState(product?.concerns.join(', ') ?? '');
  const [ingredients, setIngredients] = useState(product?.ingredients ?? '');
  const [howToUse, setHowToUse] = useState(product?.howToUse ?? '');
  const [image, setImage] = useState(product?.image ?? IMAGES[0]);
  const [isNew, setIsNew] = useState(product?.isNew ?? false);
  const [bestSeller, setBestSeller] = useState(product?.bestSeller ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const slug = product?.slug ?? slugify(name);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!name.trim()) err.name = 'Enter a product name';
    if (!slug) err.name = 'Name must contain letters or numbers';
    if (!editing && products.some((p) => p.slug === slug)) err.name = 'A product with this name already exists';
    if (!(parseFloat(gbp) > 0)) err.gbp = 'Enter a price in £';
    if (!(parseFloat(ghs) > 0)) err.ghs = 'Enter a price in GH₵';
    if (wasGbp && toMinor(wasGbp) <= toMinor(gbp)) err.wasGbp = 'Must be higher than the price';
    if (wasGhs && toMinor(wasGhs) <= toMinor(ghs)) err.wasGhs = 'Must be higher than the price';
    if (!(parseInt(stock, 10) >= 0)) err.stock = 'Enter 0 or more';
    if (!(parseInt(sizeMl, 10) > 0)) err.sizeMl = 'Enter the size in ml';
    setErrors(err);
    if (Object.keys(err).length) {
      document.getElementById(`f-${Object.keys(err)[0]}`)?.focus();
      return;
    }
    const compareAt = wasGbp && wasGhs ? { GBP: toMinor(wasGbp), GHS: toMinor(wasGhs) } : undefined;
    saveProduct(
      {
        slug,
        name: name.trim(),
        tagline: tagline.trim(),
        category,
        sizeMl: parseInt(sizeMl, 10),
        price: { GBP: toMinor(gbp), GHS: toMinor(ghs) },
        compareAt,
        skinTypes: list(skinTypes),
        concerns: list(concerns),
        ingredients: ingredients.trim(),
        howToUse: howToUse.trim(),
        image,
        isNew,
        bestSeller,
        rating: product?.rating ?? { value: 0, count: 0 },
        stock: parseInt(stock, 10),
        status,
      },
      product?.slug,
    );
    router.push('/admin/products');
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card title="Details">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field id="f-name" label="Name" error={errors.name} hint={slug ? `URL: /product/${slug}` : undefined}>
                <input id="f-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field id="f-tagline" label="Tagline"><input id="f-tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} className={inputClass} /></Field>
            </div>
            <Field id="f-category" label="Category">
              <select id="f-category" value={category} onChange={(e) => setCategory(e.target.value as Category)} className={inputClass}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </Field>
            <Field id="f-sizeMl" label="Size (ml)" error={errors.sizeMl}><input id="f-sizeMl" type="number" min="1" value={sizeMl} onChange={(e) => setSizeMl(e.target.value)} className={inputClass} /></Field>
            <Field id="f-skinTypes" label="Skin types" hint="Comma separated, e.g. Oily, Combination"><input id="f-skinTypes" value={skinTypes} onChange={(e) => setSkinTypes(e.target.value)} className={inputClass} /></Field>
            <Field id="f-concerns" label="Targets" hint="Comma separated, e.g. Blemishes, Pores"><input id="f-concerns" value={concerns} onChange={(e) => setConcerns(e.target.value)} className={inputClass} /></Field>
            <div className="sm:col-span-2">
              <Field id="f-howToUse" label="How to use"><textarea id="f-howToUse" rows={3} value={howToUse} onChange={(e) => setHowToUse(e.target.value)} className={`${inputClass} h-auto py-2`} /></Field>
            </div>
            <div className="sm:col-span-2">
              <Field id="f-ingredients" label="Ingredients (INCI)" hint="Full list in descending order of concentration. Required for cosmetics sold in the UK and Ghana."><textarea id="f-ingredients" rows={3} value={ingredients} onChange={(e) => setIngredients(e.target.value)} className={`${inputClass} h-auto py-2`} /></Field>
            </div>
          </div>
        </Card>

        <Card title="Pricing">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field id="f-gbp" label="Price (£)" error={errors.gbp}><input id="f-gbp" inputMode="decimal" value={gbp} onChange={(e) => setGbp(e.target.value)} className={inputClass} /></Field>
            <Field id="f-ghs" label="Price (GH₵)" error={errors.ghs}><input id="f-ghs" inputMode="decimal" value={ghs} onChange={(e) => setGhs(e.target.value)} className={inputClass} /></Field>
            <Field id="f-wasGbp" label="Was price (£)" error={errors.wasGbp} hint="Optional. Fill both to show a sale."><input id="f-wasGbp" inputMode="decimal" value={wasGbp} onChange={(e) => setWasGbp(e.target.value)} className={inputClass} /></Field>
            <Field id="f-wasGhs" label="Was price (GH₵)" error={errors.wasGhs}><input id="f-wasGhs" inputMode="decimal" value={wasGhs} onChange={(e) => setWasGhs(e.target.value)} className={inputClass} /></Field>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Status & stock">
          <div className="space-y-4 p-5">
            <Field id="f-status" label="Status" hint="Draft products are hidden from the store.">
              <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value as AdminProduct['status'])} className={inputClass}>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </Field>
            <Field id="f-stock" label="Stock on hand" error={errors.stock}><input id="f-stock" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className={inputClass} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} className="accent-[#ff5500]" /> Show as “New”</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bestSeller} onChange={(e) => setBestSeller(e.target.checked)} className="accent-[#ff5500]" /> Best seller</label>
          </div>
        </Card>

        <Card title="Image">
          <div className="space-y-3 p-5">
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-line"><Image src={image} alt="" fill sizes="280px" className="object-cover" /></div>
            <select aria-label="Product image" value={image} onChange={(e) => setImage(e.target.value)} className={inputClass}>
              {IMAGES.map((src) => <option key={src} value={src}>{src.split('/').pop()}</option>)}
            </select>
            <p className="text-xs text-muted">Choose from the existing photos. Uploading your own arrives with Supabase Storage.</p>
          </div>
        </Card>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className={`${btnPrimary} flex-1`}>{editing ? 'Save changes' : 'Create product'}</button>
          <Link href="/admin/products" className={btnGhost}>Cancel</Link>
        </div>
        {editing && (
          <button
            type="button"
            className="text-sm text-red-700 underline"
            onClick={() => {
              if (confirm(`Delete “${product.name}”? Past orders keep their own copy of the item.`)) {
                deleteProduct(product.slug);
                router.push('/admin/products');
              }
            }}
          >
            Delete product
          </button>
        )}
      </div>
    </form>
  );
}
