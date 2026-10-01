import { useEffect, useState } from "react";
import "./App.css";
import supabase from "../supabase/supabase-client";

const TABLE_NAME = "Usuario";
const DEPARTAMENTOS = ["Finanzas", "Seguridad", "Fiscal"];
const ROLES = ["Coordinador", "Practicante", "Jefe"];
const emptyForm = { nombre: "", departamento: "", rol: "" };

function App() {
  const [empleados, setEmpleados] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const consultarEmpleados = async () => {
    setLoading(true);
    setErrorMessage("");
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("id, nombre, departamento, rol")
      .order("id", { ascending: true });

    if (error) setErrorMessage(`No se pudieron cargar los registros: ${error.message}`);
    else setEmpleados(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    // La carga inicial sincroniza el estado con los datos remotos de Supabase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    consultarEmpleados();
  }, []);

  const actualizarCampo = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const cancelarEdicion = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const guardarEmpleado = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    if (!form.nombre.trim() || !form.departamento || !form.rol) {
      setErrorMessage("Completa nombre, departamento y rol.");
      return;
    }

    setSaving(true);
    const empleado = {
      nombre: form.nombre.trim(),
      departamento: form.departamento,
      rol: form.rol,
    };
    const response = editingId
      ? await supabase.from(TABLE_NAME).update(empleado).eq("id", editingId).select().single()
      : await supabase.from(TABLE_NAME).insert(empleado).select().single();

    if (response.error) {
      setErrorMessage(`No se pudo guardar el registro: ${response.error.message}`);
    } else if (editingId) {
      setEmpleados((current) => current.map((item) => (item.id === editingId ? response.data : item)));
      cancelarEdicion();
    } else {
      setEmpleados((current) => [...current, response.data]);
      setForm(emptyForm);
    }
    setSaving(false);
  };

  const editarEmpleado = (empleado) => {
    setEditingId(empleado.id);
    setForm({
      nombre: empleado.nombre ?? "",
      departamento: empleado.departamento ?? "",
      rol: empleado.rol ?? "",
    });
    setErrorMessage("");
  };

  const eliminarEmpleado = async (id) => {
    setErrorMessage("");
    const { error } = await supabase.from(TABLE_NAME).delete().eq("id", id);
    if (error) setErrorMessage(`No se pudo eliminar el registro: ${error.message}`);
    else {
      setEmpleados((current) => current.filter((empleado) => empleado.id !== id));
      if (editingId === id) cancelarEdicion();
    }
  };

  return (
    <main className="app-container">
      <h1>Personal</h1>
      <form className="employee-form" onSubmit={guardarEmpleado}>
        <input name="nombre" type="text" placeholder="Nombre" value={form.nombre} onChange={actualizarCampo} />
        <select name="departamento" value={form.departamento} onChange={actualizarCampo}>
          <option value="">Selecciona un departamento</option>
          {DEPARTAMENTOS.map((departamento) => <option key={departamento} value={departamento}>{departamento}</option>)}
        </select>
        <select name="rol" value={form.rol} onChange={actualizarCampo}>
          <option value="">Selecciona un rol</option>
          {ROLES.map((rol) => <option key={rol} value={rol}>{rol}</option>)}
        </select>
        <div className="form-actions">
          <button type="submit" disabled={saving}>{saving ? "Guardando..." : editingId ? "Guardar cambios" : "Agregar"}</button>
          {editingId && <button type="button" className="secondary" onClick={cancelarEdicion}>Cancelar</button>}
        </div>
      </form>

      {errorMessage && <p className="error-message">{errorMessage}</p>}
      <div className="table-wrapper">
        <table>
          <thead><tr><th>id</th><th>nombre</th><th>departamento</th><th>rol</th><th>acciones</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="5">Cargando...</td></tr> : empleados.length === 0 ? <tr><td colSpan="5">No hay registros todavía.</td></tr> : empleados.map((empleado) => (
              <tr key={empleado.id}>
                <td>{empleado.id}</td><td>{empleado.nombre}</td><td>{empleado.departamento}</td><td>{empleado.rol}</td>
                <td className="actions-cell">
                  <button type="button" className="secondary" onClick={() => editarEmpleado(empleado)}>Editar</button>
                  <button type="button" className="danger" onClick={() => eliminarEmpleado(empleado.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default App;
