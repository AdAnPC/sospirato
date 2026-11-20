import { useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, Router as WouterRouter } from 'wouter';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Activity, ArrowDownRight, ArrowRight, CalendarDays, Check, ChevronDown,
  CirclePlus, Edit2, Package2, Plus, ReceiptText, Search, ShoppingBag, Store,
  TrendingUp, X,
} from 'lucide-react';
import {
  getGetDashboardSummaryQueryKey, getGetProductsQueryKey, getGetSalesQueryKey,
  getHealthCheckQueryKey, useCancelSale, useCreateProduct, useCreateSale,
  useGetDashboardSummary, useGetProducts, useGetSales, useHealthCheck,
  useUpdateProduct,
} from '@workspace/api-client-react';
import type { Product, Sale, SaleInput } from '@workspace/api-client-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true } },
});
const money = (value: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
}).format(value);
const dateText = (value: string, withTime = false) => new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: 'short', year: 'numeric',
  ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
}).format(new Date(value));
const todayText = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long', day: 'numeric', month: 'long',
}).format(new Date());
const paymentNames: Record<string, string> = {
  cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', other: 'Otro',
};
const saleFormSchema = z.object({
  productId: z.string().min(1, 'Elige un producto.'),
  quantity: z.string().regex(/^\d+$/, 'Escribe una cantidad válida.').refine((value) => Number(value) >= 1 && Number(value) <= 999, 'La cantidad debe estar entre 1 y 999.'),
  paymentMethod: z.enum(['cash', 'transfer', 'card', 'other']),
  customerName: z.string().max(120, 'Máximo 120 caracteres.'),
  note: z.string().max(500, 'Máximo 500 caracteres.'),
});
type SaleFormInput = z.infer<typeof saleFormSchema>;
const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre del producto.').max(120, 'Máximo 120 caracteres.'),
  price: z.string().regex(/^\d+$/, 'Escribe un precio entero válido en COP.').refine((value) => Number(value) >= 0 && Number(value) <= 2_147_483_647, 'El precio debe ser un valor entero válido en COP.'),
  category: z.string().max(100, 'Máximo 100 caracteres.'),
});
type ProductFormInput = z.infer<typeof productFormSchema>;

function Shell({ children, page }: { children: ReactNode; page: string }) {
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), staleTime: 60_000 } });
  const nav = [
    { href: '/', label: 'Resumen', icon: TrendingUp, id: 'nav-overview' },
    { href: '/productos', label: 'Productos', icon: Package2, id: 'nav-products' },
    { href: '/ventas', label: 'Ventas', icon: ReceiptText, id: 'nav-sales' },
  ];
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand" data-testid="link-brand-home">
        <span className="brand-mark">S</span>
        <span><span className="brand-name">Sospirato</span><span className="brand-sub">Ventas · COL</span></span>
      </Link>
      <p className="nav-caption">Tu negocio</p>
      <nav className="nav-list" aria-label="Navegación principal">
        {nav.map(({ href, label, icon: Icon, id }) => <Link
          href={href} key={href} data-testid={id}
          className={`nav-link ${page === href ? 'active' : ''}`}
          aria-current={page === href ? 'page' : undefined}
        ><Icon /><span>{label}</span></Link>)}
      </nav>
      <div className="sidebar-foot">
        <strong><Store size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 7 }} />Sospirato COL</strong>
        <span data-testid="status-api">{health.isError ? 'Conexión pendiente' : health.isLoading ? 'Conectando…' : 'Registro listo'}</span>
      </div>
    </aside>
    <main className="main-area">
      <header className="topline">
        <div><p className="eyebrow">Sospirato COL / ventas</p><h1 className="page-title">{page === '/' ? 'Tu día, en claro.' : page === '/productos' ? 'Catálogo' : 'Historial de ventas'}</h1></div>
        <div className="date-chip"><CalendarDays />{todayText}</div>
      </header>
      <div className="page-content">{children}</div>
    </main>
  </div>;
}

function EmptyIcon({ children }: { children: ReactNode }) {
  return <span className="empty-icon">{children}</span>;
}

function Dashboard() {
  const summaryQuery = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const productsQuery = useGetProducts({ query: { queryKey: getGetProductsQueryKey() } });
  const products = Array.isArray(productsQuery.data) ? productsQuery.data : [];
  const summary = summaryQuery.data;
  const saleForm = useForm<SaleFormInput>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      productId: '',
      quantity: '1',
      paymentMethod: 'cash',
      customerName: '',
      note: '',
    },
  });
  const productId = saleForm.watch('productId');
  const quantity = Number(saleForm.watch('quantity')) || 1;
  const [feedback, setFeedback] = useState('');
  const client = useQueryClient();
  const createSale = useCreateSale();
  const selected = products.find((product) => String(product.id) === productId);
  const total = selected ? selected.price * Math.max(1, quantity) : 0;
  const saveSale = (values: SaleFormInput) => {
    if (!selected || createSale.isPending) return;
    createSale.mutate({
      data: {
        items: [{ productId: selected.id, quantity: Number(values.quantity) }],
        paymentMethod: values.paymentMethod,
        ...(values.customerName.trim() ? { customerName: values.customerName.trim() } : {}),
        ...(values.note.trim() ? { note: values.note.trim() } : {}),
      },
    }, {
      onSuccess: async () => {
        setFeedback('Venta guardada. Tus cifras ya están actualizadas.');
        saleForm.reset();
        await Promise.all([
          client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }),
          client.invalidateQueries({ queryKey: getGetSalesQueryKey() }),
        ]);
      },
      onError: () => setFeedback('No pudimos guardar la venta. Intenta de nuevo.'),
    });
  };
  return <>
    {summaryQuery.isError && <div className="error-box" role="alert">No fue posible cargar el resumen. <button className="text-link" onClick={() => summaryQuery.refetch()} data-testid="button-retry-dashboard">Reintentar</button></div>}
    <section className="dashboard-grid" aria-label="Resumen de ventas">
      <div className="hero-panel">
        <div className="hero-head">Ventas de hoy</div>
        {summaryQuery.isLoading ? <div className="loading-skeleton" /> :
          <p className="hero-amount" data-testid="value-today-total">{money(summary?.todayTotal ?? 0)}</p>}
        <div className="hero-bottom">
          <span className="hero-detail">Lo que llevas vendido hoy</span>
          <span className="hero-count" data-testid="value-today-count">{summary?.todayCount ?? 0} {summary?.todayCount === 1 ? 'venta' : 'ventas'}</span>
        </div>
      </div>
      <div className="week-panel">
        <div><p className="panel-kicker">Esta semana</p>
          {summaryQuery.isLoading ? <div className="loading-skeleton" /> : <p className="week-amount" data-testid="value-week-total">{money(summary?.weekTotal ?? 0)}</p>}
          <span className="week-meta">Acumulado desde el inicio de semana</span></div>
        <div><div className="week-rule" /><div className="week-foot"><span>Ventas registradas</span><strong data-testid="value-week-count">{summary?.weekCount ?? 0}</strong></div></div>
      </div>
    </section>

    <div className="section-row">
      <div><p className="eyebrow">Un registro rápido</p><h2 className="section-title">Anota una venta</h2></div>
      <span className="step-label">PRODUCTO · PAGO · LISTO</span>
    </div>
    <section className="quick-sale" aria-label="Registrar venta">
      <div className="quick-sale-head"><h2>Venta nueva</h2><span className="step-label">EFECTIVO PRESELECCIONADO</span></div>
      {productsQuery.isLoading ? <div style={{ padding: 20 }}><div className="loading-skeleton" /></div> :
        productsQuery.isError ? <div className="empty-products"><EmptyIcon><Activity /></EmptyIcon><div><strong>No se pudo cargar el catálogo</strong><button className="text-link" onClick={() => productsQuery.refetch()} data-testid="button-retry-sale-products">Volver a intentar</button></div></div> :
        products.length === 0 ? <div className="empty-products"><EmptyIcon><ShoppingBag /></EmptyIcon><div><strong>Primero necesitas un producto</strong>Agrega un producto al catálogo para empezar a registrar ventas. <Link href="/productos" className="text-link" data-testid="link-empty-products">Ir a productos <ArrowRight size={12} /></Link></div></div> :
        <Form {...saleForm}><form onSubmit={saleForm.handleSubmit(saveSale)}>
          <div className="sale-entry">
            <FormField control={saleForm.control} name="productId" render={({ field }) => <FormItem className="field"><FormLabel>Producto</FormLabel><FormControl><select className="control" data-testid="select-sale-product" {...field} onChange={(event) => { field.onChange(event); setFeedback(''); }}>
              <option value="">Elige un producto</option>{products.filter((p) => p.isActive).map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.price)}</option>)}
            </select></FormControl><FormMessage /></FormItem>} />
            <FormField control={saleForm.control} name="quantity" render={({ field }) => <FormItem className="field"><FormLabel>Cantidad</FormLabel><FormControl><input className="control" type="number" min="1" max="999" data-testid="input-sale-quantity" {...field} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={saleForm.control} name="paymentMethod" render={({ field }) => <FormItem className="field"><FormLabel>Pago</FormLabel><FormControl><select className="control" data-testid="select-sale-payment" {...field}>
              <option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="card">Tarjeta</option><option value="other">Otro</option>
            </select></FormControl><FormMessage /></FormItem>} />
            <div className="price-preview">Total{selected && <strong data-testid="value-sale-preview">{money(total)}</strong>}</div>
            <button className="btn btn-primary" disabled={!selected || createSale.isPending} type="submit" data-testid="button-save-sale"><Check />{createSale.isPending ? 'Guardando…' : 'Guardar venta'}</button>
          </div>
          <details style={{ padding: '0 22px 18px' }}>
            <summary style={{ cursor: 'pointer', fontSize: 11, color: '#7d887f', display: 'flex', alignItems: 'center', gap: 5 }}><ChevronDown size={13} />Añadir datos opcionales</summary>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 14 }}>
              <FormField control={saleForm.control} name="customerName" render={({ field }) => <FormItem className="field"><FormLabel>Nombre de cliente</FormLabel><FormControl><input className="control" maxLength={120} data-testid="input-sale-customer" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={saleForm.control} name="note" render={({ field }) => <FormItem className="field"><FormLabel>Nota</FormLabel><FormControl><input className="control" maxLength={500} data-testid="input-sale-note" {...field} /></FormControl><FormMessage /></FormItem>} />
            </div>
          </details>
        </form></Form>}
      {feedback && <p role="status" className="status-note" style={{ padding: '0 22px 14px', margin: 0 }} data-testid="status-sale-feedback">{feedback}</p>}
    </section>

    <section className="lower-grid">
      <div className="surface">
        <h2 className="surface-title">Lo que más se mueve</h2>
        {summaryQuery.isLoading ? <div className="loading-skeleton" /> : (summary?.topProducts?.length ?? 0) > 0 ?
          summary!.topProducts.slice(0, 5).map((item, index) => <div className="rank-row" key={`${item.productName}-${index}`} data-testid={`row-top-product-${index}`}>
            <span className="rank-no">0{index + 1}</span><div><div className="rank-name">{item.productName}</div><div className="rank-meta">{item.quantity} unidades</div></div><span className="rank-total">{money(item.total)}</span>
          </div>) : <p className="quiet-empty" data-testid="empty-top-products">Aún no hay ventas para destacar. Las ventas que registres aparecerán aquí.</p>}
      </div>
      <div className="surface">
        <h2 className="surface-title">Un buen comienzo</h2>
        <p className="quiet-empty" style={{ paddingTop: 0 }}>Cada venta queda guardada con su producto, cantidad y forma de pago. Revisa el historial cuando quieras encontrar o corregir un registro.</p>
        <Link href="/ventas" className="text-link" data-testid="link-open-history">Ver historial de ventas <ArrowRight size={13} /></Link>
      </div>
    </section>
  </>;
}

function ProductDialog({ product, close }: { product: Product | null; close: () => void }) {
  const form = useForm<ProductFormInput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name ?? '',
      price: product ? String(product.price) : '',
      category: product?.category ?? '',
    },
  });
  const [error, setError] = useState('');
  const client = useQueryClient();
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const pending = create.isPending || update.isPending;
  const submit = (values: ProductFormInput) => {
    const data = { name: values.name, price: Number(values.price), category: values.category.trim() || null };
    const done = () => { void client.invalidateQueries({ queryKey: getGetProductsQueryKey() }); close(); };
    const failed = () => setError('No se pudo guardar. Revisa los datos e inténtalo otra vez.');
    if (product) update.mutate({ id: product.id, data }, { onSuccess: done, onError: failed });
    else create.mutate({ data }, { onSuccess: done, onError: failed });
  };
  return <div className="overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
    <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title">
      <div className="dialog-head"><div><p className="eyebrow">{product ? 'Editar ficha' : 'Nuevo en catálogo'}</p><h2 id="product-dialog-title" className="dialog-title">{product ? 'Editar producto' : 'Agregar producto'}</h2><p className="dialog-desc">El precio se guarda en pesos colombianos enteros.</p></div><button className="icon-btn" onClick={close} aria-label="Cerrar" data-testid="button-close-product-dialog"><X /></button></div>
      <Form {...form}><form className="dialog-form" onSubmit={form.handleSubmit(submit)}>
        <FormField control={form.control} name="name" render={({ field }) => <FormItem className="field"><FormLabel>Nombre del producto</FormLabel><FormControl><input className="control" autoFocus maxLength={120} data-testid="input-product-name" {...field} /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="price" render={({ field }) => <FormItem className="field"><FormLabel>Precio (COP)</FormLabel><FormControl><input className="control" type="number" min="0" step="1" data-testid="input-product-price" {...field} /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="category" render={({ field }) => <FormItem className="field"><FormLabel>Categoría <span className="status-note">opcional</span></FormLabel><FormControl><input className="control" maxLength={100} data-testid="input-product-category" {...field} /></FormControl><FormMessage /></FormItem>} />
        {error && <div className="form-error" role="alert" data-testid="status-product-form-error">{error}</div>}
        <div className="dialog-actions"><button type="button" className="btn btn-quiet" onClick={close} data-testid="button-dismiss-product">Cancelar</button><button type="submit" className="btn btn-primary" disabled={pending} data-testid="button-submit-product">{pending ? 'Guardando…' : product ? 'Guardar cambios' : 'Agregar producto'}</button></div>
      </form></Form>
    </section>
  </div>;
}

function ProductsPage() {
  const query = useGetProducts({ query: { queryKey: getGetProductsQueryKey() } });
  const client = useQueryClient();
  const update = useUpdateProduct();
  const [editing, setEditing] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const products = Array.isArray(query.data) ? query.data : [];
  const items = products.filter((item) => item.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')) || (item.category ?? '').toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
  const toggle = (product: Product) => update.mutate({ id: product.id, data: { isActive: !product.isActive } }, {
    onSuccess: () => { void client.invalidateQueries({ queryKey: getGetProductsQueryKey() }); setNotice(product.isActive ? 'Producto desactivado.' : 'Producto activado.'); },
    onError: () => setNotice('No se pudo cambiar el estado. Intenta de nuevo.'),
  });
  return <>
    <div className="section-row" style={{ marginTop: 0 }}>
      <div><p className="eyebrow">Lo que ofreces</p><h2 className="section-title">Productos registrados</h2></div>
      <button className="btn btn-primary" onClick={() => { setEditing(null); setDialogOpen(true); }} data-testid="button-add-product"><Plus />Agregar producto</button>
    </div>
    <div className="toolbar"><div className="search-wrap"><Search /><input className="control" placeholder="Buscar producto o categoría" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-products" /></div><span className="status-note" data-testid="text-product-count">{products.length} productos</span></div>
    {notice && <p role="status" className="status-note" data-testid="status-product-action">{notice}</p>}
    {query.isError && <div className="error-box" role="alert">No fue posible cargar los productos. <button onClick={() => query.refetch()} className="text-link" data-testid="button-retry-products">Reintentar</button></div>}
    <div className="data-panel">
      {query.isLoading ? <div style={{ padding: 20 }}><div className="loading-skeleton" /></div> : items.length === 0 ?
        <div className="table-empty"><EmptyIcon>{search ? <Search /> : <Package2 />}</EmptyIcon><h3>{search ? 'No encontramos coincidencias' : 'Tu catálogo empieza aquí'}</h3><p>{search ? 'Prueba con otro nombre o categoría.' : 'Agrega tus productos y sus precios para poder registrarlos al momento de una venta.'}</p>{!search && <button className="btn btn-primary" onClick={() => { setEditing(null); setDialogOpen(true); }} data-testid="button-empty-add-product"><CirclePlus />Agregar primer producto</button>}</div> :
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Estado</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead><tbody>
          {items.map((product) => <tr key={product.id} data-testid={`row-product-${product.id}`}><td className="main-cell">{product.name}</td><td>{product.category || '—'}</td><td className="mono">{money(product.price)}</td><td><span className={`tag ${product.isActive ? '' : 'tag-muted'}`} data-testid={`status-product-${product.id}`}>{product.isActive ? 'Activo' : 'Inactivo'}</span></td><td><div className="row-actions">
            <button className="icon-btn" aria-label={`Editar ${product.name}`} title="Editar" onClick={() => { setEditing(product); setDialogOpen(true); }} data-testid={`button-edit-product-${product.id}`}><Edit2 /></button>
            <button className="btn btn-quiet" style={{ minHeight: 32, padding: '0 10px', fontSize: 10 }} disabled={update.isPending} onClick={() => toggle(product)} data-testid={`button-toggle-product-${product.id}`}>{product.isActive ? 'Desactivar' : 'Activar'}</button>
          </div></td></tr>)}
        </tbody></table></div>}
    </div>
    {dialogOpen && <ProductDialog key={editing?.id ?? 'new'} product={editing} close={() => setDialogOpen(false)} />}
  </>;
}

function SalesPage() {
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const params = useMemo(() => ({ ...(from ? { from } : {}), ...(to ? { to } : {}), limit: 200 }), [from, to]);
  const salesQuery = useGetSales(params, { query: { queryKey: getGetSalesQueryKey(params) } });
  const client = useQueryClient();
  const cancel = useCancelSale();
  const [notice, setNotice] = useState('');
  const sales = Array.isArray(salesQuery.data) ? salesQuery.data : [];
  const filtered = sales.filter((sale) => {
    const query = search.trim().toLocaleLowerCase('es');
    return !query || [sale.customerName, sale.note, ...sale.items.map((item) => item.productName), String(sale.id)].some((v) => (v ?? '').toLocaleLowerCase('es').includes(query));
  });
  const cancelOne = (sale: Sale) => {
    if (!window.confirm(`¿Cancelar la venta del ${dateText(sale.createdAt)} por ${money(sale.total)}? La venta quedará en el historial como cancelada.`)) return;
    cancel.mutate({ id: sale.id }, {
      onSuccess: async () => {
        setNotice('Venta cancelada. El registro permanece en el historial.');
        await Promise.all([
          client.invalidateQueries({ queryKey: getGetSalesQueryKey() }),
          client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }),
        ]);
      },
      onError: () => setNotice('No se pudo cancelar la venta. Intenta de nuevo.'),
    });
  };
  return <>
    <div className="section-row" style={{ marginTop: 0 }}>
      <div><p className="eyebrow">Registros guardados</p><h2 className="section-title">Todas tus ventas</h2></div>
      <span className="step-label">COP · {filtered.length} REGISTROS</span>
    </div>
    <div className="toolbar">
      <div className="search-wrap"><Search /><input className="control" placeholder="Buscar producto, cliente o nota" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-sales" /></div>
      <label className="status-note" htmlFor="sales-from">Desde</label><input id="sales-from" type="date" className="control" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} data-testid="input-sales-from" />
      <label className="status-note" htmlFor="sales-to">Hasta</label><input id="sales-to" type="date" className="control" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} data-testid="input-sales-to" />
      {(from || to || search) && <button className="btn btn-quiet" style={{ minHeight: 38 }} onClick={() => { setFrom(''); setTo(''); setSearch(''); }} data-testid="button-clear-sales-filters"><X />Limpiar</button>}
    </div>
    {notice && <p role="status" className="status-note" data-testid="status-sale-action">{notice}</p>}
    {salesQuery.isError && <div className="error-box" role="alert">No fue posible cargar el historial. <button className="text-link" onClick={() => salesQuery.refetch()} data-testid="button-retry-sales">Reintentar</button></div>}
    <div className="data-panel">
      {salesQuery.isLoading ? <div style={{ padding: 20 }}><div className="loading-skeleton" /></div> : filtered.length === 0 ?
        <div className="table-empty"><EmptyIcon>{search || from || to ? <Search /> : <ReceiptText />}</EmptyIcon><h3>{search || from || to ? 'No hay ventas con esos filtros' : 'Aún no hay ventas'}</h3><p>{search || from || to ? 'Ajusta la búsqueda o el rango de fechas para ver otros registros.' : 'Cuando registres una venta, su detalle y total aparecerán aquí.'}</p>{(search || from || to) && <button className="btn btn-quiet" onClick={() => { setFrom(''); setTo(''); setSearch(''); }} data-testid="button-empty-clear-sales">Limpiar filtros</button>}</div> :
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Fecha</th><th>Detalle</th><th>Pago</th><th>Total</th><th>Estado</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead><tbody>
          {filtered.map((sale) => <tr key={sale.id} data-testid={`row-sale-${sale.id}`}><td className="mono">{dateText(sale.createdAt, true)}</td><td><div className="main-cell">{sale.items.map((item) => `${item.quantity} × ${item.productName}`).join(', ')}</div>{sale.customerName && <div className="status-note" style={{ marginTop: 4 }}>{sale.customerName}</div>}{sale.note && <div className="status-note" style={{ marginTop: 4 }}>{sale.note}</div>}</td><td>{paymentNames[sale.paymentMethod] ?? sale.paymentMethod}</td><td className="mono">{money(sale.total)}</td><td><span className={`tag ${sale.status === 'cancelled' ? 'tag-muted' : ''}`} data-testid={`status-sale-${sale.id}`}>{sale.status === 'completed' ? 'Completada' : 'Cancelada'}</span></td><td><div className="row-actions">{sale.status === 'completed' && <button className="btn btn-danger" style={{ minHeight: 32, padding: '0 10px', fontSize: 10 }} onClick={() => cancelOne(sale)} disabled={cancel.isPending} data-testid={`button-cancel-sale-${sale.id}`}><ArrowDownRight size={13} />Cancelar</button>}</div></td></tr>)}
        </tbody></table></div>}
    </div>
  </>;
}

function Router() {
  return <Switch>
    <Route path="/"><Shell page="/"><Dashboard /></Shell></Route>
    <Route path="/productos"><Shell page="/productos"><ProductsPage /></Shell></Route>
    <Route path="/ventas"><Shell page="/ventas"><SalesPage /></Shell></Route>
    <Route><NotFound /></Route>
  </Switch>;
}

function App() {
  return <QueryClientProvider client={queryClient}>
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter>
  </QueryClientProvider>;
}

export default App;
