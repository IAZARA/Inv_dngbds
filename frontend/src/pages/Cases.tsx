import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { CaseRecord, EstadoRequerimiento } from '../types';
import CaseForm from './cases/CaseForm';
import CasesFilters from './cases/CasesFilters';
import CasesList from './cases/CasesList';
import { buildPayload } from './cases/helpers';
import type { CaseFormValues } from './cases/formSchema';


type CasesListResponse = { cases: CaseRecord[] };

const CasesPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const canEdit = useMemo(
    () => (user ? ['ADMIN', 'OPERATOR'].includes(user.role) : false),
    [user]
  );

  const [showForm, setShowForm] = useState(false);
  const [editingCase, setEditingCase] = useState<CaseRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<'TODOS' | EstadoRequerimiento>('TODOS');
  const [jurisdiccionFilter, setJurisdiccionFilter] =
    useState<'TODAS' | CaseFormValues['jurisdiccion']>('TODAS');
  const [fuerzaFilter, setFuerzaFilter] =
    useState<'TODAS' | CaseFormValues['fuerzaAsignada']>('TODAS');

  const casesQuery = useQuery({
    queryKey: ['cases'],
    queryFn: async () => {
      const { data } = await api.get<CasesListResponse>('/cases');
      return data.cases;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CaseFormValues) => {
      const { data } = await api.post('/cases', buildPayload(payload));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setShowForm(false);
      setEditingCase(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: CaseFormValues }) => {
      const { data } = await api.patch(`/cases/${id}`, buildPayload(payload));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setShowForm(false);
      setEditingCase(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/cases/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setEditingCase((current) => {
        if (current && current.id === id) {
          setShowForm(false);
          return null;
        }
        return current;
      });
    }
  });

  const handledCases = useMemo(() => casesQuery.data ?? [], [casesQuery.data]);

  const filteredCases = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return handledCases.filter((item) => {
      const searchPool = [
        item.numeroCausa ?? undefined,
        item.caratula ?? undefined,
        item.persona?.firstName ?? undefined,
        item.persona?.lastName ?? undefined,
        item.persona
          ? `${item.persona.firstName ?? ''} ${item.persona.lastName ?? ''}`.trim() || undefined
          : undefined
      ];

      const matchesSearch =
        normalizedSearch.length === 0 ||
        searchPool.some((field) => {
          if (!field) return false;
          return field.toLowerCase().includes(normalizedSearch);
        });

      if (!matchesSearch) return false;

      const matchesEstado =
        estadoFilter === 'TODOS' || item.estadoRequerimiento === estadoFilter;

      if (!matchesEstado) return false;

      const matchesJurisdiccion =
        jurisdiccionFilter === 'TODAS' || item.jurisdiccion === jurisdiccionFilter;

      if (!matchesJurisdiccion) return false;

      const forceValue = (item.fuerzaAsignada ?? 'S/D') as CaseFormValues['fuerzaAsignada'];
      const matchesFuerza = fuerzaFilter === 'TODAS' || forceValue === fuerzaFilter;

      return matchesFuerza;
    });
  }, [handledCases, estadoFilter, fuerzaFilter, jurisdiccionFilter, searchTerm]);

  const handleStartCreate = () => {
    setEditingCase(null);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setEditingCase(null);
    setShowForm(false);
  };

  const handleFormSubmit = (values: CaseFormValues) => {
    if (!canEdit) return;
    if (editingCase) {
      updateMutation.mutate({ id: editingCase.id, payload: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleEditRecord = (record: CaseRecord) => {
    setEditingCase(record);
    setShowForm(true);
  };

  const handleDeleteRecord = (record: CaseRecord) => {
    if (!canEdit) return;
    if (window.confirm('¿Eliminar caso?')) {
      deleteMutation.mutate(record.id);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setEstadoFilter('TODOS');
    setJurisdiccionFilter('TODAS');
    setFuerzaFilter('TODAS');
  };

  const deleteInProgressId = deleteMutation.variables ?? null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="page">
      <div
        className="page-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div>
          <h2>Casos</h2>
          <p>Gestiona los expedientes de investigación y los datos asociados a cada persona.</p>
        </div>
        <button className="btn primary" type="button" onClick={handleStartCreate} disabled={!canEdit}>
          + Nuevo caso
        </button>
      </div>

      {showForm ? (
        <CaseForm
          canEdit={canEdit}
          editingCase={editingCase}
          onCancel={handleCancelForm}
          onSubmit={handleFormSubmit}
          onEditingCaseChange={setEditingCase}
          isSaving={isSaving}
        />
      ) : (
        <>
          <CasesFilters
            searchTerm={searchTerm}
            estadoFilter={estadoFilter}
            jurisdiccionFilter={jurisdiccionFilter}
            fuerzaFilter={fuerzaFilter}
            onSearchChange={setSearchTerm}
            onEstadoChange={setEstadoFilter}
            onJurisdiccionChange={setJurisdiccionFilter}
            onFuerzaChange={setFuerzaFilter}
            onClear={handleClearFilters}
          />

          <CasesList
            isLoading={casesQuery.isLoading}
            isError={casesQuery.isError}
            cases={handledCases}
            filteredCases={filteredCases}
            canEdit={canEdit}
            onEdit={handleEditRecord}
            onDelete={handleDeleteRecord}
            deleteInProgressId={deleteInProgressId}
          />
        </>
      )}
    </div>
  );
};

export default CasesPage;
