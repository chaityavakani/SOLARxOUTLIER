import React, { useEffect, useState } from 'react';
import {
  Truck,
  Boxes,
  Barcode,
  CheckCircle2,
  Package,
  Plus,
  ShieldCheck,
  AlertCircle,
  Clock,
  ArrowRight,
  Send,
  Scan,
  Navigation,
  MapPin,
} from 'lucide-react';
import { api, errorText } from '../shared/api.js';
import { money } from '../shared/formatters.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';

export default function WarehouseDispatchPage({ user, onNavigate }) {
  const [activeTab, setActiveTab] = useState('DISPATCHES'); // 'DISPATCHES', 'STOCK'
  const [dispatches, setDispatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Packing & Scanning Workspace
  const [selectedDispatch, setSelectedDispatch] = useState(null);
  const [dispatchDetailLoading, setDispatchDetailLoading] = useState(false);
  const [serialScanInput, setSerialScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [availableSerials, setAvailableSerials] = useState([]);

  // Dispatch Truck Modal
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [truckForm, setTruckForm] = useState({
    vehicleNo: 'GJ-01-SP-2026',
    driverName: 'Vikram Trucking',
    driverPhone: '9876543210',
  });

  // Delivery Modal
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({ receivedByName: '' });

  // Inward Purchase Form
  const [purchaseForm, setPurchaseForm] = useState({
    productId: '',
    quantity: '1',
    unitCost: '',
    supplierName: 'Adani Solar / Microtek Distributor',
  });
  const [autoSerials, setAutoSerials] = useState([]);
  const [serialsLoading, setSerialsLoading] = useState(false);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  async function loadData() {
    setLoading(true);
    setMessage('');
    try {
      if (activeTab === 'DISPATCHES') {
        const res = await api.get('/dispatches');
        setDispatches(res.data.data || []);
      } else {
        const res = await api.get('/inventory/products');
        setProducts(res.data.data || []);
      }
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setLoading(false);
    }
  }

  async function openDispatch(id) {
    setDispatchDetailLoading(true);
    setMessage('');
    setSuccessMessage('');
    try {
      const res = await api.get(`/dispatches/${id}`);
      const dispatch = res.data.data;
      setSelectedDispatch(dispatch);
      // Load available serials for all serialized products in this dispatch
      const serializedProductIds = (dispatch.lines || [])
        .filter((l) => l.product?.isSerialized)
        .map((l) => l.productId);
      if (serializedProductIds.length > 0) {
        const sRes = await api.get(`/inventory/available-serials?productIds=${serializedProductIds.join(',')}`);
        setAvailableSerials(sRes.data.data || []);
      } else {
        setAvailableSerials([]);
      }
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setDispatchDetailLoading(false);
    }
  }

  async function handleScanSerial(e) {
    e.preventDefault();
    if (!serialScanInput.trim() || !selectedDispatch) return;
    setScanning(true);
    setMessage('');
    setSuccessMessage('');
    try {
      const res = await api.post(`/dispatches/${selectedDispatch.id}/scan`, {
        serialNumber: serialScanInput.trim(),
      });
      setSelectedDispatch(res.data.data);
      setSuccessMessage(`Serial number ${serialScanInput.trim()} scanned and verified!`);
      setSerialScanInput('');
      // Remove scanned serial from available list
      setAvailableSerials((prev) => prev.filter((s) => s.serialNumber !== serialScanInput.trim()));
      loadData();
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setScanning(false);
    }
  }

  async function handlePackHardware(lineId, requiredQty) {
    if (!selectedDispatch) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await api.post(`/dispatches/${selectedDispatch.id}/pack`, {
        lineId,
        quantity: Number(requiredQty),
      });
      setSelectedDispatch(res.data.data);
      setSuccessMessage('Hardware packed into shipment container.');
      loadData();
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDispatchTruckSubmit(e) {
    e.preventDefault();
    if (!selectedDispatch) return;
    setBusy(true);
    try {
      await api.post(`/dispatches/${selectedDispatch.id}/dispatch`, truckForm);
      setDispatchModalOpen(false);
      openDispatch(selectedDispatch.id);
      loadData();
    } catch (err) {
      alert(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeliverySubmit(e) {
    e.preventDefault();
    if (!selectedDispatch) return;
    setBusy(true);
    try {
      await api.post(`/dispatches/${selectedDispatch.id}/deliver`, {
        receivedByName: deliveryForm.receivedByName || 'Homeowner',
      });
      setDeliveryModalOpen(false);
      openDispatch(selectedDispatch.id);
      loadData();
      alert('Delivery confirmed! 20-year Solar Panel & 2-year Inverter/Battery warranty clock has started automatically.');
    } catch (err) {
      alert(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleInwardStock(e) {
    e.preventDefault();
    if (selectedProduct?.isSerialized && autoSerials.length !== Number(purchaseForm.quantity)) {
      setMessage('Serial numbers are still generating. Please wait a moment and try again.');
      return;
    }
    setBusy(true);
    setMessage('');
    setSuccessMessage('');
    try {
      await api.post('/inventory/purchases', {
        supplierName: purchaseForm.supplierName,
        items: [
          {
            productId: purchaseForm.productId,
            quantity: Number(purchaseForm.quantity),
            unitCost: Number(purchaseForm.unitCost),
            ...(selectedProduct?.isSerialized ? { serialNumbers: autoSerials } : {}),
          },
        ],
      });
      setSuccessMessage(`Stock received! ${selectedProduct?.isSerialized ? `${autoSerials.length} serial numbers registered.` : ''}`);
      setPurchaseForm({ productId: '', quantity: '1', unitCost: '', supplierName: 'Adani Solar / Microtek Distributor' });
      setAutoSerials([]);
      loadData();
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const selectedProduct = products.find((p) => p.id === purchaseForm.productId);

  async function fetchAutoSerials(productId, quantity) {
    if (!productId || !quantity || Number(quantity) < 1) { setAutoSerials([]); return; }
    const prod = products.find((p) => p.id === productId);
    if (!prod?.isSerialized) { setAutoSerials([]); return; }
    setSerialsLoading(true);
    try {
      const res = await api.get(`/inventory/next-serials?productId=${productId}&quantity=${quantity}`);
      setAutoSerials(res.data.data || []);
    } catch (_) {
      setAutoSerials([]);
    } finally {
      setSerialsLoading(false);
    }
  }

  return (
    <div className="warehouse-page">
      {/* Top Banner */}
      <div className="welcome-card mb-4">
        <div>
          <p className="eyebrow text-amber-400">DISPATCH DAY & SERIAL NUMBERS (SCENE 3)</p>
          <h2>Warehouse Dispatch & Serial Number Tracking</h2>
          <p>
            Scan every inverter and battery before the truck leaves so you know exactly which unit went to which homeowner.
            Delivery automatically triggers the 20-year and 2-year warranty clocks!
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="status-tab-bar mb-4">
        <button
          className={`tab-btn ${activeTab === 'DISPATCHES' ? 'active' : ''}`}
          onClick={() => setActiveTab('DISPATCHES')}
        >
          Dispatch Queue & Pick Lists
        </button>
        <button
          className={`tab-btn ${activeTab === 'STOCK' ? 'active' : ''}`}
          onClick={() => setActiveTab('STOCK')}
        >
          Warehouse Stock & Inward Receiving
        </button>
      </div>

      {/* Tab 1: Dispatch Queue */}
      {activeTab === 'DISPATCHES' && (
        <div className="panel">
          <div className="panel-head mb-3">
            <div>
              <h2>Dispatch Pick Lists</h2>
              <p>Pack hardware, scan high-value serialized equipment, and dispatch delivery vehicles.</p>
            </div>
          </div>

          {loading ? (
            <p className="muted p-6">Loading dispatch queue…</p>
          ) : dispatches.length === 0 ? (
            <div className="empty-state">
              <Truck size={32} />
              <h3>No dispatches in queue</h3>
              <p>Confirmed project orders automatically appear here as packing pick lists.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dispatch Ref</th>
                    <th>Project</th>
                    <th>Customer Name</th>
                    <th>Items Status</th>
                    <th>Vehicle Details</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatches.map((d) => (
                    <tr key={d.id} className="clickable-row" onClick={() => openDispatch(d.id)}>
                      <td><strong>{d.number}</strong></td>
                      <td>{d.project?.code}</td>
                      <td>
                        <div className="font-semibold">{d.project?.customer?.name}</div>
                        <small className="muted">{d.project?.customer?.phone}</small>
                      </td>
                      <td>
                        <small className="text-slate-600">
                          {d.lines?.length || 0} component lines
                        </small>
                      </td>
                      <td>
                        {d.vehicleNo ? (
                          <span className="text-xs font-mono">{d.vehicleNo} ({d.driverName})</span>
                        ) : (
                          <small className="muted">Not assigned</small>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={d.status} size="small" />
                      </td>
                      <td>
                        <button className="button outline small-button">
                          {['PENDING', 'PACKING'].includes(d.status) ? 'Scan Serials' : 'View Shipment'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Warehouse Stock & Inward */}
      {activeTab === 'STOCK' && (
        <div>
          {/* Stock Inward Receiving Form */}
          <div className="panel p-5 mb-6">
            <div className="panel-head mb-4">
              <div>
                <h2>Inward Stock Receiving</h2>
                <p>Register newly arrived solar panels, inverters, and batteries with their unique serial numbers.</p>
              </div>
            </div>

            {successMessage && <p className="form-message success mb-3">{successMessage}</p>}
            {message && <p className="form-message error mb-3">{message}</p>}

            <form onSubmit={handleInwardStock} className="survey-form">
              <div className="form-row">
                <label>
                  Select Product to Receive
                  <select
                    required
                    value={purchaseForm.productId}
                    onChange={(e) => {
                      setPurchaseForm({ ...purchaseForm, productId: e.target.value });
                      fetchAutoSerials(e.target.value, purchaseForm.quantity);
                    }}
                  >
                    <option value="">Choose product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · SKU: {p.sku} {p.isSerialized ? '(SERIAL TRACKED)' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Distributor / Supplier Name
                  <input
                    type="text"
                    required
                    value={purchaseForm.supplierName}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, supplierName: e.target.value })}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Quantity
                  <input
                    type="number"
                    min="1"
                    required
                    value={purchaseForm.quantity}
                    onChange={(e) => {
                      setPurchaseForm({ ...purchaseForm, quantity: e.target.value });
                      fetchAutoSerials(purchaseForm.productId, e.target.value);
                    }}
                  />
                </label>

                <label>
                  Unit Purchase Cost Price (₹)
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 58000"
                    value={purchaseForm.unitCost}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, unitCost: e.target.value })}
                  />
                </label>
              </div>

              {selectedProduct?.isSerialized && (
                <div className="auto-serials-box">
                  <label style={{marginBottom: 6}}>
                    Auto-Generated Serial Numbers
                    <span className="serial-auto-badge">Auto</span>
                  </label>
                  {serialsLoading ? (
                    <p className="muted text-xs">Generating serial numbers…</p>
                  ) : autoSerials.length > 0 ? (
                    <div className="serial-chips-wrap">
                      {autoSerials.map((s) => (
                        <span key={s} className="serial-chip">{s}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="muted text-xs">Select a product and quantity to preview serial numbers.</p>
                  )}
                  <p className="text-xs muted mt-1">
                    Serial numbers are generated automatically in sequence and are globally unique.
                  </p>
                </div>
              )}

              <button className="button primary small-button mt-2" disabled={busy}>
                {busy ? 'Receiving…' : 'Receive & Record Inward Stock'}
              </button>
            </form>
          </div>

          {/* Current Stock Inventory Table */}
          <div className="panel p-5">
            <div className="panel-head mb-3">
              <div>
                <h2>Live Inventory Levels</h2>
                <p>Available stock on hand in the central warehouse.</p>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Current Stock</th>
                    <th>Cost Price</th>
                    <th>Selling Price</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.sku}</strong></td>
                      <td>{item.name}</td>
                      <td><small className="muted">{item.category}</small></td>
                      <td>
                        {item.isSerialized ? (
                          <span className="badge-blue text-xs px-2 py-0.5 rounded">Serialized</span>
                        ) : (
                          <span className="muted text-xs">Standard Qty</span>
                        )}
                      </td>
                      <td>
                        <strong className={item.stockQty <= 5 ? 'text-red-700' : 'text-emerald-700'}>
                          {item.isSerialized ? 'Tracked by Unit' : `${item.stockQty} ${item.unit}`}
                        </strong>
                      </td>
                      <td>{money(item.costPrice)}</td>
                      <td>{money(item.sellPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Scanning & Packing Workspace Modal */}
      {selectedDispatch && (
        <Modal
          isOpen={Boolean(selectedDispatch)}
          onClose={() => setSelectedDispatch(null)}
          title={`Dispatch Shipment: ${selectedDispatch.number}`}
          subtitle={`Project ${selectedDispatch.project?.code} · Homeowner: ${selectedDispatch.project?.customer?.name}`}
          maxWidth="900px"
        >
          {dispatchDetailLoading ? (
            <p className="muted p-4">Loading shipment details…</p>
          ) : (
            <div className="dispatch-modal-content">
              {successMessage && <p className="form-message success mb-3">{successMessage}</p>}
              {message && <p className="form-message error mb-3">{message}</p>}

              {/* Status Header */}
              <div className="p-3 bg-slate-50 rounded mb-4">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <span className="text-xs muted">Dispatch Status:</span>
                    <div className="mt-1"><StatusBadge status={selectedDispatch.status} /></div>
                  </div>
                  {selectedDispatch.vehicleNo && (
                    <div className="text-sm text-right">
                      <span className="muted block">Vehicle & Driver:</span>
                      <strong>{selectedDispatch.vehicleNo} · {selectedDispatch.driverName} ({selectedDispatch.driverPhone})</strong>
                    </div>
                  )}
                </div>

                {/* Delivery Address + Maps Button */}
                {(() => {
                  const c = selectedDispatch.project?.customer;
                  const parts = [
                    selectedDispatch.project?.siteAddress,
                    c?.addressLine,
                    c?.city,
                    c?.state,
                    c?.pincode,
                  ].filter(Boolean);
                  if (!parts.length) return null;
                  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(parts.join(', '))}`;
                  return (
                    <div className="mt-3 pt-3 border-t flex items-start justify-between gap-3">
                      <div>
                        <span className="text-xs muted flex items-center gap-1 mb-1"><MapPin size={12} /> Delivery Address</span>
                        <p className="text-sm font-semibold" style={{margin:0}}>{parts.join(', ')}</p>
                      </div>
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="button outline small-button"
                        style={{color:'#1a73e8',borderColor:'#1a73e8',gap:5,textDecoration:'none',whiteSpace:'nowrap',flexShrink:0}}
                      >
                        <Navigation size={14} /> Open in Maps
                      </a>
                    </div>
                  );
                })()}
              </div>

              {/* Barcode / Serial Scanner Field */}
              {['PENDING', 'PACKING', 'READY'].includes(selectedDispatch.status) && (
                <div className="serial-scan-box p-4 bg-amber-50 border border-amber-200 rounded mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Barcode size={18} className="text-amber-800" />
                    <strong className="text-sm text-amber-900">
                      Select or Scan Serial Number
                    </strong>
                  </div>
                  <p className="text-xs muted mb-3">
                    Pick from available stock below, or type / scan a barcode manually.
                  </p>
                  <form onSubmit={handleScanSerial} className="serial-scan-form">
                    {/* Dropdown of available serials grouped by product */}
                    {availableSerials.length > 0 && (
                      <select
                        className="search-input"
                        value={serialScanInput}
                        onChange={(e) => setSerialScanInput(e.target.value)}
                      >
                        <option value="">— Pick from available stock —</option>
                        {(() => {
                          const groups = {};
                          availableSerials.forEach((s) => {
                            const key = s.product.name;
                            if (!groups[key]) groups[key] = [];
                            groups[key].push(s);
                          });
                          return Object.entries(groups).map(([productName, units]) => (
                            <optgroup key={productName} label={`${productName} (${units.length} available)`}>
                              {units.map((u) => (
                                <option key={u.id} value={u.serialNumber}>
                                  {u.serialNumber}
                                </option>
                              ))}
                            </optgroup>
                          ));
                        })()}
                      </select>
                    )}
                    {availableSerials.length === 0 && (
                      <p className="text-xs text-amber-800 mb-1">No stock available — receive inward stock first.</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        required
                        placeholder="Or type / scan barcode manually…"
                        value={serialScanInput}
                        onChange={(e) => setSerialScanInput(e.target.value)}
                        className="search-input flex-1"
                      />
                      <button type="submit" className="button primary small-button" disabled={scanning}>
                        <Scan size={15} /> {scanning ? 'Verifying…' : 'Confirm Serial'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Pick List Lines Breakdown */}
              <div className="pick-list-section mb-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Packing Pick List & Verification
                </h4>
                <div className="table-wrap">
                  <table className="data-table text-sm">
                    <thead>
                      <tr>
                        <th>Item Component</th>
                        <th>Type</th>
                        <th>Required</th>
                        <th>Scanned / Packed</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDispatch.lines?.map((line) => {
                        const isComplete = line.product.isSerialized
                          ? line.scannedQty >= Number(line.requiredQty)
                          : line.packedQty >= Number(line.requiredQty);

                        return (
                          <tr key={line.id}>
                            <td>
                              <strong>{line.product.name}</strong>
                              <small className="muted block">SKU: {line.product.sku}</small>
                            </td>
                            <td>
                              {line.product.isSerialized ? (
                                <span className="badge-blue text-xs px-2 py-0.5 rounded">Serialized</span>
                              ) : (
                                <span className="muted text-xs">Bulk Hardware</span>
                              )}
                            </td>
                            <td>{Number(line.requiredQty)} {line.product.unit}</td>
                            <td>
                              <strong>
                                {line.product.isSerialized ? line.scannedQty : line.packedQty}
                              </strong>{' '}
                              / {Number(line.requiredQty)}
                            </td>
                            <td>
                              {isComplete ? (
                                <span className="badge-green text-xs px-2 py-0.5 rounded inline-flex items-center gap-1">
                                  <CheckCircle2 size={12} /> Packed
                                </span>
                              ) : (
                                <span className="badge-amber text-xs px-2 py-0.5 rounded">
                                  Pending Packing
                                </span>
                              )}
                            </td>
                            <td>
                              {!line.product.isSerialized && line.packedQty < Number(line.requiredQty) && (
                                <button
                                  className="button outline small-button text-xs"
                                  onClick={() => handlePackHardware(line.id, line.requiredQty)}
                                >
                                  Mark Packed
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Scanned Units Record */}
              {selectedDispatch.serialUnits?.length > 0 && (
                <div className="scanned-units-list p-3 bg-slate-50 rounded mb-4">
                  <span className="text-xs font-bold text-slate-700 block mb-1">
                    Verified Units Scanned on this Truck ({selectedDispatch.serialUnits.length}):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {selectedDispatch.serialUnits.map((unit) => (
                      <span key={unit.id} className="badge-blue text-xs px-2 py-1 rounded font-mono">
                        {unit.serialNumber} ({unit.product?.name})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="dispatch-actions mt-4 pt-3 border-t flex justify-end gap-2">
                {selectedDispatch.status === 'READY' && (
                  <button
                    className="button primary small-button"
                    onClick={() => setDispatchModalOpen(true)}
                  >
                    <Truck size={15} /> Dispatch Truck with Materials
                  </button>
                )}

                {selectedDispatch.status === 'DISPATCHED' && (
                  <button
                    className="button primary small-button bg-emerald-600 text-white"
                    onClick={() => {
                      setDeliveryForm({ receivedByName: selectedDispatch.project?.customer?.name || '' });
                      setDeliveryModalOpen(true);
                    }}
                  >
                    <ShieldCheck size={15} /> Confirm Site Delivery (Starts Warranty Clock)
                  </button>
                )}

                {selectedDispatch.status === 'DELIVERED' && (
                  <div className="text-emerald-700 font-semibold flex items-center gap-1 text-sm">
                    <CheckCircle2 size={16} /> Delivered on site. Warranties are active from delivery date.
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Dispatch Truck Details Modal */}
      <Modal
        isOpen={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        title="Dispatch Truck"
        subtitle="Record the vehicle and driver details before shipment leaves the warehouse."
      >
        <form onSubmit={handleDispatchTruckSubmit} className="survey-form">
          <label>
            Vehicle Number
            <input
              type="text"
              required
              value={truckForm.vehicleNo}
              onChange={(e) => setTruckForm({ ...truckForm, vehicleNo: e.target.value })}
              placeholder="e.g. GJ-01-SP-2026"
            />
          </label>

          <div className="form-row">
            <label>
              Driver Name
              <input
                type="text"
                required
                value={truckForm.driverName}
                onChange={(e) => setTruckForm({ ...truckForm, driverName: e.target.value })}
                placeholder="Driver full name"
              />
            </label>

            <label>
              Driver Contact Phone
              <input
                type="tel"
                required
                value={truckForm.driverPhone}
                onChange={(e) => setTruckForm({ ...truckForm, driverPhone: e.target.value })}
                placeholder="10-digit mobile"
              />
            </label>
          </div>

          <div className="modal-actions mt-4 flex justify-end gap-2">
            <button type="button" className="button outline small-button" onClick={() => setDispatchModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="button primary small-button" disabled={busy}>
              {busy ? 'Dispatching…' : 'Confirm Dispatch'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delivery Modal */}
      <Modal
        isOpen={deliveryModalOpen}
        onClose={() => setDeliveryModalOpen(false)}
        title="Confirm On-Site Delivery"
        subtitle="Scene 3: The moment delivery is done, the warranty clock starts by itself for every serial number."
      >
        <form onSubmit={handleDeliverySubmit} className="survey-form">
          <label>
            Received By (Homeowner or Site Contact Name)
            <input
              type="text"
              required
              value={deliveryForm.receivedByName}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, receivedByName: e.target.value })}
              placeholder="e.g. Ramesh Patel"
            />
          </label>

          <div className="p-3 bg-emerald-50 text-emerald-900 rounded text-xs mt-2 space-y-1">
            <strong>Automatic Warranty Clock Activation:</strong>
            <div>• Solar Panels: 20 Years (240 Months) Coverage</div>
            <div>• Inverters & Batteries: 2 Years (24 Months) Coverage</div>
            <div>No one has to type dates into paper registers!</div>
          </div>

          <div className="modal-actions mt-4 flex justify-end gap-2">
            <button type="button" className="button outline small-button" onClick={() => setDeliveryModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="button primary small-button bg-emerald-600 text-white" disabled={busy}>
              {busy ? 'Confirming…' : 'Confirm Delivery & Start Warranty'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

