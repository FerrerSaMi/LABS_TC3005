'use client'
import { useEffect, useState } from 'react'
import { addDoc, collection, onSnapshot, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from './../firebase/firebase.config'

type Item = {
  id: string;
  name: string;
  department: string;
}

const departments = ['Coordinador', 'Supervisor', 'Administrador'];

export default function Home() {
  const [name, setName] = useState('');
  const [department, setDepartment] = useState(departments[0]);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'items'),
      (snapshot) => {
        setItems(snapshot.docs.map((item) => ({
          id: item.id,
          name: item.data().name as string,
          department: item.data().department as string,
        })));
        setIsLoading(false);
        setError('');
      },
      (snapshotError) => {
        console.error(snapshotError);
        setError(`No se pudo conectar con Firebase: ${snapshotError.message}`);
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [])

  const handleAdd = async () => {
    const value = name.trim();
    if (!value || isSaving) return;

    setIsSaving(true);
    setError('');
    try {
      await addDoc(collection(db, 'items'), { name: value, department });
      setName('');
    } catch (operationError) {
      console.error(operationError);
      setError('No se pudo agregar el elemento. Revisa las reglas de Firestore.');
    } finally {
      setIsSaving(false);
    }
  }

  const handleDelete = async (id: string) => {
    if (!id || isSaving) return;

    setIsSaving(true);
    setError('');
    try {
      await deleteDoc(doc(db, 'items', id));
    } catch (operationError) {
      console.error(operationError);
      setError('No se pudo eliminar el elemento.');
    } finally {
      setIsSaving(false);
    }
  }

  const handleEdit = async (id: string) => {
    if (!id || isSaving) return;
    const editName = prompt('Escribe el nuevo nombre');
    const value = editName?.trim();
    if (!value) return;
    const editDepartment = prompt(`Escribe el departamento (${departments.join(', ')})`);
    if (!editDepartment || !departments.includes(editDepartment)) return;

    setIsSaving(true);
    setError('');
    try {
      await updateDoc(doc(db, 'items', id), { name: value, department: editDepartment });
    } catch (operationError) {
      console.error(operationError);
      setError('No se pudo editar el elemento.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20" >
      <h1>Personal</h1>
      <input type="text" className="border-2" placeholder="Nombre" value={name} onChange={(e) =>
        setName(e.target.value)} />
      <select className="border-2" value={department} onChange={(e) => setDepartment(e.target.value)}>
        {departments.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <button className="border p-2" onClick={handleAdd} disabled={isSaving}>
        {isSaving ? 'Guardando...' : 'Agregar'}
      </button>
      {isLoading && <p>Cargando elementos...</p>}
      {error && <p className="text-red-600">{error}</p>}
      <table>
        <thead>
          <tr><th>Nombre</th><th>Departamento</th><th>Acciones</th></tr>
        </thead>
        <tbody>
        {items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.department}</td><td>
          <button className="p-2 border bg-yellow-500 text-white cursor-pointer"
            onClick={() => { handleEdit(item.id) }}>Edit</button>
          <button className="p-2 border bg-red-500 text-white cursor-pointer"
            onClick={() => { handleDelete(item.id) }}>Delete</button>
        </td></tr>)}
        </tbody>
      </table>
    </div>
  );
}
