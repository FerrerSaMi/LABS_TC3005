import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Filter,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';

const STORAGE_KEY = 'lab1-risk-audit-records';

const initialRisks = [
  {
    id: 'RA-001',
    asset: 'Portal de clientes',
    risk: 'Acceso no autorizado a informacion sensible',
    category: 'Seguridad',
    probability: 4,
    impact: 5,
    controls: 'MFA, monitoreo de sesiones y revision de roles',
    owner: 'Equipo IAM',
    status: 'Abierto',
    reviewDate: '2026-10-15',
  },
  {
    id: 'RA-002',
    asset: 'Base de datos financiera',
    risk: 'Perdida de disponibilidad por respaldos incompletos',
    category: 'Continuidad',
    probability: 3,
    impact: 5,
    controls: 'Backups diarios, pruebas de restauracion mensual',
    owner: 'Infraestructura',
    status: 'En mitigacion',
    reviewDate: '2026-10-30',
  },
  {
    id: 'RA-003',
    asset: 'Proceso de altas de proveedores',
    risk: 'Alta de proveedor sin validacion documental',
    category: 'Cumplimiento',
    probability: 2,
    impact: 4,
    controls: 'Checklist digital y aprobacion de compras',
    owner: 'Compras',
    status: 'Controlado',
    reviewDate: '2026-11-08',
  },
];

const emptyForm = {
  asset: '',
  risk: '',
  category: 'Seguridad',
  probability: 3,
  impact: 3,
  controls: '',
  owner: '',
  status: 'Abierto',
  reviewDate: '',
};

const categories = ['Seguridad', 'Continuidad', 'Cumplimiento', 'Operacion', 'Financiero'];
const statuses = ['Abierto', 'En mitigacion', 'Controlado', 'Cerrado'];

function loadStoredRisks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return initialRisks;
    }

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : initialRisks;
  } catch {
    return initialRisks;
  }
}

function getScore(record) {
  return Number(record.probability) * Number(record.impact);
}

function getLevel(score) {
  if (score >= 17) {
    return { label: 'Critico', className: 'level-critical' };
  }

  if (score >= 10) {
    return { label: 'Alto', className: 'level-high' };
  }

  if (score >= 5) {
    return { label: 'Medio', className: 'level-medium' };
  }

  return { label: 'Bajo', className: 'level-low' };
}

function createRiskId(records) {
  const maxId = records.reduce((max, record) => {
    const number = Number(String(record.id).replace('RA-', ''));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);

  return `RA-${String(maxId + 1).padStart(3, '0')}`;
}

function App() {
  const [records, setRecords] = useState(loadStoredRisks);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      // The CRUD remains usable when browser storage is unavailable.
    }
  }, [records]);

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesTerm = [record.id, record.asset, record.risk, record.category, record.owner]
        .join(' ')
        .toLowerCase()
        .includes(term);
      const matchesStatus = statusFilter === 'Todos' || record.status === statusFilter;

      return matchesTerm && matchesStatus;
    });
  }, [records, search, statusFilter]);

  const metrics = useMemo(() => {
    const critical = records.filter((record) => getScore(record) >= 17).length;
    const open = records.filter((record) => record.status !== 'Cerrado').length;
    const average =
      records.length === 0
        ? 0
        : Math.round(records.reduce((sum, record) => sum + getScore(record), 0) / records.length);

    return { total: records.length, critical, open, average };
  }, [records]);

  const formScore = getScore(form);
  const formLevel = getLevel(formScore);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  }

  function validate() {
    const nextErrors = {};

    if (!form.asset.trim()) {
      nextErrors.asset = 'Indica el activo o proceso auditado.';
    }

    if (!form.risk.trim()) {
      nextErrors.risk = 'Describe el riesgo encontrado.';
    }

    if (!form.controls.trim()) {
      nextErrors.controls = 'Registra al menos un control o accion.';
    }

    if (!form.owner.trim()) {
      nextErrors.owner = 'Asigna un responsable.';
    }

    if (!form.reviewDate) {
      nextErrors.reviewDate = 'Define una fecha de revision.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setErrors({});
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    if (editingId) {
      setRecords((current) =>
        current.map((record) => (record.id === editingId ? { ...form, id: editingId } : record)),
      );
    } else {
      setRecords((current) => [{ ...form, id: createRiskId(current) }, ...current]);
    }

    resetForm();
  }

  function handleEdit(record) {
    setEditingId(record.id);
    setForm({
      asset: record.asset,
      risk: record.risk,
      category: record.category,
      probability: record.probability,
      impact: record.impact,
      controls: record.controls,
      owner: record.owner,
      status: record.status,
      reviewDate: record.reviewDate,
    });
    setErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleDelete(id) {
    const selected = records.find((record) => record.id === id);
    const confirmed = window.confirm(`Eliminar ${id}: ${selected?.risk ?? 'riesgo'}?`);

    if (confirmed) {
      setRecords((current) => current.filter((record) => record.id !== id));
      if (editingId === id) {
        resetForm();
      }
    }
  }

  function resetData() {
    const confirmed = window.confirm('Restaurar los registros de ejemplo?');

    if (confirmed) {
      setRecords(initialRisks);
      resetForm();
      setSearch('');
      setStatusFilter('Todos');
    }
  }

  return (
    <main className="app-shell">
      <section className="top-bar" aria-labelledby="page-title">
        <div>
          <span className="eyebrow">LAB1 · CRUD React</span>
          <h1 id="page-title">Auditoria de Riesgos</h1>
          <p>
            Registro unico para crear, consultar, actualizar y eliminar riesgos detectados durante
            una auditoria.
          </p>
        </div>
        <button className="ghost-button" type="button" onClick={resetData}>
          <RotateCcw aria-hidden="true" size={18} />
          Restaurar
        </button>
      </section>

      <section className="metrics-grid" aria-label="Resumen de auditoria">
        <MetricCard icon={ClipboardList} label="Riesgos registrados" value={metrics.total} />
        <MetricCard icon={AlertTriangle} label="Riesgos criticos" value={metrics.critical} />
        <MetricCard icon={Filter} label="Riesgos activos" value={metrics.open} />
        <MetricCard icon={CheckCircle2} label="Promedio de score" value={metrics.average} />
      </section>

      <section className="workspace">
        <form className="risk-form" onSubmit={handleSubmit} noValidate>
          <div className="section-heading">
            <div>
              <span className="eyebrow">{editingId ? `Editando ${editingId}` : 'Nuevo registro'}</span>
              <h2>{editingId ? 'Actualizar riesgo' : 'Crear riesgo'}</h2>
            </div>
            {editingId && (
              <button className="icon-button" type="button" onClick={resetForm} aria-label="Cancelar edicion">
                <X aria-hidden="true" size={18} />
              </button>
            )}
          </div>

          <div className="field-group">
            <label htmlFor="asset">Activo o proceso</label>
            <input
              id="asset"
              value={form.asset}
              onChange={(event) => updateField('asset', event.target.value)}
              placeholder="Ej. Plataforma de pagos"
              aria-invalid={Boolean(errors.asset)}
              aria-describedby={errors.asset ? 'asset-error' : undefined}
            />
            {errors.asset && (
              <span className="field-error" id="asset-error">
                {errors.asset}
              </span>
            )}
          </div>

          <div className="field-group">
            <label htmlFor="risk">Riesgo identificado</label>
            <textarea
              id="risk"
              value={form.risk}
              onChange={(event) => updateField('risk', event.target.value)}
              placeholder="Describe el evento de riesgo"
              rows="3"
              aria-invalid={Boolean(errors.risk)}
              aria-describedby={errors.risk ? 'risk-error' : undefined}
            />
            {errors.risk && (
              <span className="field-error" id="risk-error">
                {errors.risk}
              </span>
            )}
          </div>

          <div className="form-grid">
            <div className="field-group">
              <label htmlFor="category">Categoria</label>
              <select
                id="category"
                value={form.category}
                onChange={(event) => updateField('category', event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label htmlFor="status">Estado</label>
              <select
                id="status"
                value={form.status}
                onChange={(event) => updateField('status', event.target.value)}
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-grid">
            <div className="field-group">
              <label htmlFor="probability">Probabilidad: {form.probability}</label>
              <input
                id="probability"
                type="range"
                min="1"
                max="5"
                value={form.probability}
                onChange={(event) => updateField('probability', Number(event.target.value))}
              />
            </div>

            <div className="field-group">
              <label htmlFor="impact">Impacto: {form.impact}</label>
              <input
                id="impact"
                type="range"
                min="1"
                max="5"
                value={form.impact}
                onChange={(event) => updateField('impact', Number(event.target.value))}
              />
            </div>
          </div>

          <div className="score-preview" aria-live="polite">
            <span>Score {formScore}</span>
            <strong className={formLevel.className}>{formLevel.label}</strong>
          </div>

          <div className="field-group">
            <label htmlFor="controls">Controles o acciones</label>
            <textarea
              id="controls"
              value={form.controls}
              onChange={(event) => updateField('controls', event.target.value)}
              placeholder="Controles existentes o acciones de mitigacion"
              rows="3"
              aria-invalid={Boolean(errors.controls)}
              aria-describedby={errors.controls ? 'controls-error' : undefined}
            />
            {errors.controls && (
              <span className="field-error" id="controls-error">
                {errors.controls}
              </span>
            )}
          </div>

          <div className="form-grid">
            <div className="field-group">
              <label htmlFor="owner">Responsable</label>
              <input
                id="owner"
                value={form.owner}
                onChange={(event) => updateField('owner', event.target.value)}
                placeholder="Ej. Seguridad TI"
                aria-invalid={Boolean(errors.owner)}
                aria-describedby={errors.owner ? 'owner-error' : undefined}
              />
              {errors.owner && (
                <span className="field-error" id="owner-error">
                  {errors.owner}
                </span>
              )}
            </div>

            <div className="field-group">
              <label htmlFor="reviewDate">Fecha de revision</label>
              <input
                id="reviewDate"
                type="date"
                value={form.reviewDate}
                onChange={(event) => updateField('reviewDate', event.target.value)}
                aria-invalid={Boolean(errors.reviewDate)}
                aria-describedby={errors.reviewDate ? 'reviewDate-error' : undefined}
              />
              {errors.reviewDate && (
                <span className="field-error" id="reviewDate-error">
                  {errors.reviewDate}
                </span>
              )}
            </div>
          </div>

          <button className="primary-button" type="submit">
            <Plus aria-hidden="true" size={18} />
            {editingId ? 'Guardar cambios' : 'Crear riesgo'}
          </button>
        </form>

        <section className="records-panel" aria-labelledby="records-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Inventario</span>
              <h2 id="records-title">Riesgos auditados</h2>
            </div>
            <span className="result-count">{filteredRecords.length} resultados</span>
          </div>

          <div className="toolbar" role="search">
            <div className="search-box">
              <Search aria-hidden="true" size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por ID, activo, riesgo o responsable"
                aria-label="Buscar riesgos"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filtrar por estado"
            >
              <option>Todos</option>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>

          {filteredRecords.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Riesgo</th>
                    <th>Nivel</th>
                    <th>Estado</th>
                    <th>Responsable</th>
                    <th>Revision</th>
                    <th aria-label="Acciones"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => {
                    const score = getScore(record);
                    const level = getLevel(score);

                    return (
                      <tr key={record.id}>
                        <td className="strong-cell">{record.id}</td>
                        <td>
                          <strong>{record.asset}</strong>
                          <span>{record.risk}</span>
                          <small>{record.category} · {record.controls}</small>
                        </td>
                        <td>
                          <span className={`risk-badge ${level.className}`}>
                            {level.label} · {score}
                          </span>
                        </td>
                        <td>{record.status}</td>
                        <td>{record.owner}</td>
                        <td>{record.reviewDate}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="icon-button"
                              type="button"
                              onClick={() => handleEdit(record)}
                              aria-label={`Editar ${record.id}`}
                            >
                              <Edit3 aria-hidden="true" size={17} />
                            </button>
                            <button
                              className="icon-button danger"
                              type="button"
                              onClick={() => handleDelete(record.id)}
                              aria-label={`Eliminar ${record.id}`}
                            >
                              <Trash2 aria-hidden="true" size={17} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <ClipboardList aria-hidden="true" size={34} />
              <h3>Sin riesgos para mostrar</h3>
              <p>Ajusta la busqueda o registra un nuevo riesgo de auditoria.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function MetricCard({ icon: Icon, label, value }) {
  return (
    <article className="metric-card">
      <Icon aria-hidden="true" size={22} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export default App;
