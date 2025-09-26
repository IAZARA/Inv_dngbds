import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const canEdit = useMemo(
    () => (user ? ['ADMIN', 'OPERATOR'].includes(user.role) : false),
    [user]
  );

  const canDelete = useMemo(
    () => (user ? user.role === 'ADMIN' : false),
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
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  // Initialize filters and pagination from URL search params on mount
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    const estado = (searchParams.get('estado') ?? 'TODOS') as 'TODOS' | EstadoRequerimiento;
    const jurisdiccion = (searchParams.get('jurisdiccion') ?? 'TODAS') as
      | 'TODAS'
      | CaseFormValues['jurisdiccion'];
    const fuerza = (searchParams.get('fuerza') ?? 'TODAS') as
      | 'TODAS'
      | CaseFormValues['fuerzaAsignada'];
    const pageParam = Number(searchParams.get('page') ?? '1');
    const page = Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : 1;

    setSearchTerm(q);
    setEstadoFilter(estado);
    setJurisdiccionFilter(jurisdiccion);
    setFuerzaFilter(fuerza);
    setCurrentPage(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const totalPages = useMemo(() => {
    if (filteredCases.length === 0) return 1;
    return Math.ceil(filteredCases.length / PAGE_SIZE);
  }, [filteredCases.length]);

  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredCases.slice(start, start + PAGE_SIZE);
  }, [filteredCases, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, estadoFilter, jurisdiccionFilter, fuerzaFilter, handledCases.length]);

  // Keep URL search params in sync with current filters and page
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('q', searchTerm);
    if (estadoFilter !== 'TODOS') params.set('estado', estadoFilter);
    if (jurisdiccionFilter !== 'TODAS') params.set('jurisdiccion', jurisdiccionFilter);
    if (fuerzaFilter !== 'TODAS') params.set('fuerza', fuerzaFilter);
    if (currentPage !== 1) params.set('page', String(currentPage));
    setSearchParams(params, { replace: true });
  }, [searchTerm, estadoFilter, jurisdiccionFilter, fuerzaFilter, currentPage, setSearchParams]);

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => handledCases.some((item) => item.id === id))
    );
  }, [handledCases]);

  const handleChangePage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

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
    if (!canDelete) return;
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

  const toggleSelectMode = () => {
    setSelectMode((prev) => {
      if (prev) {
        setSelectedIds([]);
      }
      return !prev;
    });
  };

  const handleToggleSelection = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const handleExportExcel = async () => {
    if (selectedIds.length === 0) return;
    try {
      setExporting(true);
      const response = await api.post(
        '/cases/export-excel',
        { ids: selectedIds },
        { responseType: 'blob' }
      );
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `casos_${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setSelectMode(false);
      setSelectedIds([]);
    } catch (error) {
      console.error('No se pudo exportar los casos', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Casos</h2>
          <p>Gestiona los expedientes de investigación y los datos asociados a cada persona.</p>
          <p className="text-sm text-gray-600" style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
            Los casos se encuentran ordenados por defecto según la prioridad establecida por el Comando Unificado Federal de Recaptura de Evadidos.
          </p>
        </div>
        {canEdit && (
          <div className="case-toolbar">
            <button className="btn ghost" type="button" onClick={toggleSelectMode}>
              {selectMode ? 'Cancelar selección' : 'Exportar a Excel'}
            </button>
            {selectMode ? (
              <button
                className="btn primary"
                type="button"
                onClick={handleExportExcel}
                disabled={selectedIds.length === 0 || exporting}
              >
                {exporting ? 'Descargando…' : `Descargar (${selectedIds.length})`}
              </button>
            ) : (
              <button className="btn primary" type="button" onClick={handleStartCreate}>
                + Nuevo caso
              </button>
            )}
          </div>
        )}
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
            paginatedCases={paginatedCases}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={handleEditRecord}
            onDelete={handleDeleteRecord}
            deleteInProgressId={deleteInProgressId}
            page={currentPage}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            totalItems={filteredCases.length}
            onPageChange={handleChangePage}
            onCreate={handleStartCreate}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelection={handleToggleSelection}
          />
        </>
      )}
    </div>
  );
};

export default CasesPage;
