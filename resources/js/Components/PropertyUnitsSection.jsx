import ConfirmActionModal from '@/Components/ConfirmActionModal';
import RoomForm from '@/Components/RoomForm';
import useFloorLabel from '@/hooks/useFloorLabel';
import usePresence from '@/hooks/usePresence';
import { useTranslation } from '@/localization';
import { Link, router, useForm } from '@inertiajs/react';
import { Building2, ChevronRight, ChevronsDownUp, ChevronsUpDown, DoorOpen, Edit, Layers, Loader2, Plus, Search, Sparkles, Trash2, User, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { checkDescriptionResponse, descriptionErrorMessage } from '@/lib/descriptionRequest';
import { csrfFetch } from '@/lib/csrf';

const inputClass = 'mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-[#0E3B2E] focus:ring-2 focus:ring-[#0E3B2E]/15';

const statusStyles = {
    available: 'bg-green-50 text-green-800 ring-green-600/20',
    occupied: 'bg-blue-50 text-blue-800 ring-blue-600/20',
    maintenance: 'bg-amber-50 text-amber-800 ring-amber-600/20',
};

export { useFloorLabel };

// With more floors than this, empty floors start hidden (Add unit at the top still reaches them).
const EMPTY_FLOORS_SHOWN_UP_TO = 10;

/**
 * Property → Unit → Room. Units are a category on one floor; rooms are the
 * rentable spaces inside a unit. Floors fold open and closed so a tall
 * building stays easy to read.
 */
export default function PropertyUnitsSection({ property, floorNumbers = [], canEdit = false, canEditProperty = canEdit }) {
    const { t } = useTranslation();
    const floorLabel = useFloorLabel();
    const [dialog, setDialog] = useState(null); // { unit?: object, floor?: number }
    const [roomDialog, setRoomDialog] = useState(null); // { unitId?: number, room?: object }
    const [deleting, setDeleting] = useState(null);
    const [deleteProcessing, setDeleteProcessing] = useState(false);
    const [query, setQuery] = useState('');
    const [showEmpty, setShowEmpty] = useState(floorNumbers.length <= EMPTY_FLOORS_SHOWN_UP_TO);

    const units = property.property_units || [];
    // A unit is a space on a floor (number, size, rent, photos). Older rooms
    // filed under a category are shown on their floor the same way.
    const allRooms = [
        ...units.flatMap(unit => (unit.rooms || []).map(room => ({ ...room, floor_number: room.floor_number ?? unit.floor_number }))),
        ...(property.units || []).filter(room => !room.property_unit_id),
    ];
    const roomCount = allRooms.length;

    // Which floors are open, remembered per property in this browser.
    const storageKey = `ituze.property.${property.id}.open-floors`;
    const [openFloors, setOpenFloors] = useState(() => {
        try {
            const saved = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
            if (Array.isArray(saved)) return new Set(saved);
        } catch { /* storage unavailable */ }
        const used = [...new Set(allRooms.map(room => Number(room.floor_number)))];
        // A few floors in use: open them; a tall building starts folded.
        return new Set(used.length <= 3 ? used : []);
    });
    useEffect(() => {
        try { window.localStorage.setItem(storageKey, JSON.stringify([...openFloors])); } catch { /* storage unavailable */ }
    }, [openFloors, storageKey]);
    const toggleFloor = (floor) => setOpenFloors(current => {
        const next = new Set(current);
        if (next.has(floor)) next.delete(floor); else next.add(floor);
        return next;
    });

    // After a unit is saved, open the floor it is on.
    const floorSignature = (list) => Object.fromEntries([...new Set(list.map(room => Number(room.floor_number)))].map(floor => [
        floor,
        list.filter(room => Number(room.floor_number) === floor).map(room => `${room.id}:${room.unit_number}`).join('|'),
    ]));
    const previousSignature = useRef(null);
    useEffect(() => {
        const current = floorSignature(allRooms);
        const previous = previousSignature.current;
        previousSignature.current = current;
        if (!previous) return;
        const changed = Object.keys(current).filter(floor => current[floor] !== previous[floor]).map(Number);
        if (changed.length) setOpenFloors(open => new Set([...open, ...changed]));
    }, [property]);

    // Search by unit number, client, use or floor name.
    const q = query.trim().toLowerCase();
    const floors = useMemo(() => [...floorNumbers].sort((a, b) => b - a).map(floor => {
        const onFloor = allRooms.filter(room => Number(room.floor_number) === floor)
            .sort((a, b) => String(a.unit_number).localeCompare(String(b.unit_number), undefined, { numeric: true }));
        if (!q || floorLabel(floor).toLowerCase().includes(q)) return { floor, rooms: onFloor, total: onFloor.length };
        const matches = onFloor.filter(room => [room.unit_number, room.active_tenancy?.tenant?.name, room.active_tenancy?.business_use]
            .some(value => String(value || '').toLowerCase().includes(q)));
        return { floor, rooms: matches, total: onFloor.length };
    }), [floorNumbers, property, q]);

    const emptyFloorCount = floors.filter(f => f.total === 0).length;
    const visibleFloors = floors.filter(f => (q ? f.rooms.length > 0 : (f.total > 0 || showEmpty)));
    const floorsWithUnits = floors.filter(f => f.total > 0).map(f => f.floor);

    const confirmDelete = () => {
        if (!deleting) return;
        setDeleteProcessing(true);
        router.delete(route('properties.property-units.destroy', [property.id, deleting.id]), {
            preserveScroll: true,
            onFinish: () => {
                setDeleteProcessing(false);
                setDeleting(null);
            },
        });
    };

    const addUnitButton = (floor) => canEditProperty && (
        <button
            type="button"
            onClick={() => setRoomDialog({ floor })}
            className="inline-flex flex-none items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#0E3B2E] transition-colors hover:bg-[#0E3B2E]/10"
            aria-label={t('Add a unit on :floor', { floor: floorLabel(floor) })}
        >
            <Plus size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{t('Add unit')}</span>
        </button>
    );

    return (
        <section aria-labelledby="units-heading" className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-6">
                <div>
                    <h2 id="units-heading" className="text-lg font-semibold text-gray-900">{t('Units')}</h2>
                    <p className="mt-0.5 text-sm text-gray-600">
                        {roomCount === 1 ? t('1 unit') : t(':count units', { count: roomCount })}
                        {' · '}{t(':count available', { count: allRooms.filter(room => room.status === 'available').length })}
                    </p>
                </div>
                {canEditProperty && (
                    <button
                        type="button"
                        onClick={() => setRoomDialog({ floor: null })}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#124B3A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E3B2E]"
                    >
                        <Plus size={16} aria-hidden="true" />
                        {t('Add unit')}
                    </button>
                )}
            </div>

            {roomCount > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-4 py-3 sm:px-6">
                    <div className="relative min-w-[200px] flex-1">
                        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                        <label htmlFor="units-search" className="sr-only">{t('Find a unit, client or floor')}</label>
                        <input
                            id="units-search"
                            type="search"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder={t('Find a unit, client or floor')}
                            className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-[#0E3B2E] focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/15"
                        />
                    </div>
                    <button type="button" onClick={() => setOpenFloors(new Set(floorsWithUnits))} disabled={Boolean(q)}
                        className="inline-flex items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50">
                        <ChevronsUpDown size={14} aria-hidden="true" />{t('Expand all')}
                    </button>
                    <button type="button" onClick={() => setOpenFloors(new Set())} disabled={Boolean(q)}
                        className="inline-flex items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50">
                        <ChevronsDownUp size={14} aria-hidden="true" />{t('Collapse all')}
                    </button>
                    {emptyFloorCount > 0 && !q && (
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-xs font-medium text-gray-700">
                            <input type="checkbox" checked={showEmpty} onChange={e => setShowEmpty(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#0E3B2E] focus:ring-[#0E3B2E]" />
                            {t('Show empty floors (:count)', { count: emptyFloorCount })}
                        </label>
                    )}
                </div>
            )}

            {roomCount === 0 && (
                <div className="px-6 pb-2 pt-8 text-center">
                    <Building2 size={44} className="mx-auto mb-3 text-gray-300" aria-hidden="true" />
                    <h3 className="text-base font-semibold text-gray-900">{t('No units yet')}</h3>
                    <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
                        {t('Add the units of each floor: number (e.g. 001), size in m², monthly rent and photos. What a unit is used for is chosen with each client who rents it.')}
                    </p>
                </div>
            )}

            {q && visibleFloors.length === 0 && (
                <p className="px-6 py-8 text-center text-sm text-gray-600" role="status">{t('Nothing matches “:query”.', { query: query.trim() })}</p>
            )}

            <ol className="divide-y divide-gray-100">
                {visibleFloors.map(({ floor, rooms, total }) => {
                    if (total === 0) {
                        return (
                            <li key={floor} className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
                                <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                                    <span className="w-4 flex-none" aria-hidden="true" />
                                    <Layers size={16} aria-hidden="true" className="flex-none text-gray-300" />
                                    {floorLabel(floor)}
                                    <span className="truncate text-xs font-normal normal-case tracking-normal text-gray-500">· {t('No units on this floor yet.')}</span>
                                </h3>
                                {addUnitButton(floor)}
                            </li>
                        );
                    }

                    const open = Boolean(q) || openFloors.has(floor);
                    const available = rooms.filter(room => room.status === 'available').length;
                    const panelId = `floor-${floor}-panel`;

                    return (
                        <li key={floor}>
                            <div className={`flex items-center gap-2 px-4 py-3 transition-colors sm:px-6 ${open ? 'bg-gray-50/70' : 'hover:bg-gray-50'}`}>
                                <h3 className="min-w-0 flex-1">
                                    <button
                                        type="button"
                                        onClick={() => toggleFloor(floor)}
                                        disabled={Boolean(q)}
                                        aria-expanded={open}
                                        aria-controls={panelId}
                                        className="flex w-full min-w-0 items-center gap-2 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E]/40 disabled:cursor-default"
                                    >
                                        <ChevronRight size={16} aria-hidden="true" className={`flex-none text-gray-500 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
                                        <Layers size={16} aria-hidden="true" className="flex-none text-[#0E3B2E]" />
                                        <span className="flex-none text-sm font-semibold uppercase tracking-wide text-gray-800">{floorLabel(floor)}</span>
                                        <span className="truncate text-xs text-gray-600">
                                            · {total === 1 ? t('1 unit') : t(':count units', { count: total })}
                                            {rooms.length > 0 && <> · <span className="font-medium text-green-800">{t(':count available', { count: available })}</span></>}
                                        </span>
                                    </button>
                                </h3>
                                {addUnitButton(floor)}
                            </div>

                            {open && (
                                <div id={panelId} className="animate-fade-in px-4 pb-4 pt-1 sm:px-6">
                                    <RoomList property={property} rooms={rooms} canEdit={canEdit} onEditRoom={(room) => setRoomDialog({ room })} />
                                </div>
                            )}
                        </li>
                    );
                })}

                {!q && !showEmpty && emptyFloorCount > 0 && (
                    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-gray-600 sm:px-6">
                        <span>{t(':count empty floors are hidden.', { count: emptyFloorCount })}</span>
                        <button type="button" onClick={() => setShowEmpty(true)} className="font-semibold text-[#0E3B2E] underline underline-offset-2">
                            {t('Show them')}
                        </button>
                    </li>
                )}

            </ol>

            <UnitDialog
                open={dialog !== null}
                property={property}
                floorNumbers={floorNumbers}
                unit={dialog?.unit}
                initialFloor={dialog?.floor}
                onClose={() => setDialog(null)}
            />

            <RoomDialog
                open={roomDialog !== null}
                property={property}
                room={roomDialog?.room}
                unitId={roomDialog?.unitId}
                floors={floorNumbers}
                floor={roomDialog?.floor ?? null}
                onClose={() => setRoomDialog(null)}
            />

            <ConfirmActionModal
                open={deleting !== null}
                tone="danger"
                title={t('Delete this unit?')}
                message={deleting ? `${deleting.unit_type?.name} · ${floorLabel(deleting.floor_number)}` : ''}
                confirmLabel={t('Delete unit')}
                processing={deleteProcessing}
                onConfirm={confirmDelete}
                onCancel={() => !deleteProcessing && setDeleting(null)}
            />
        </section>
    );
}

function UnitCard({ property, unit, rooms: shownRooms, forceOpen = false, canEdit, onEdit, onDelete, onAddRoom, onEditRoom }) {
    const { t } = useTranslation();
    const allRooms = unit.rooms || [];
    const rooms = shownRooms ?? allRooms;
    const occupied = allRooms.filter(room => room.status === 'occupied').length;
    const [roomsOpen, setRoomsOpen] = useState(true);
    const showRooms = forceOpen || roomsOpen;
    const roomsId = `unit-${unit.id}-rooms`;


    return (
        <article className="rounded-2xl border border-gray-200 bg-gray-50/40">
            <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                    <h4 className="font-semibold text-gray-900">{unit.unit_type?.name}</h4>
                    <p className="mt-0.5 text-sm text-gray-600">
                        {allRooms.length === 1 ? t('1 room') : t(':count rooms', { count: allRooms.length })}
                        {allRooms.length > 0 && ` · ${t(':count occupied', { count: occupied })}`}
                    </p>
                    {allRooms.length > 0 && !forceOpen && (
                        <button type="button" onClick={() => setRoomsOpen(v => !v)} aria-expanded={roomsOpen} aria-controls={roomsId}
                            className="mt-1.5 inline-flex items-center gap-1 rounded-lg text-xs font-semibold text-[#0E3B2E] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E]/40">
                            <ChevronRight size={13} aria-hidden="true" className={`transition-transform duration-200 ${roomsOpen ? 'rotate-90' : ''}`} />
                            {roomsOpen ? t('Hide rooms') : t('Show rooms')}
                        </button>
                    )}
                    {unit.description && <p className="mt-1 text-sm text-gray-600">{unit.description}</p>}
                </div>
                {canEdit && (
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={onAddRoom}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0E3B2E] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#124B3A]"
                        >
                            <DoorOpen size={14} aria-hidden="true" />
                            {t('Add room')}
                        </button>
                        <button
                            type="button"
                            onClick={onEdit}
                            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                        >
                            <Edit size={14} aria-hidden="true" />
                            {t('Edit')}
                        </button>
                        {onDelete && <button
                            type="button"
                            onClick={onDelete}
                            disabled={allRooms.length > 0}
                            title={allRooms.length > 0 ? t('Remove the rooms of this unit before deleting it.') : undefined}
                            className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Trash2 size={14} aria-hidden="true" />
                            {t('Delete')}
                        </button>}
                    </div>
                )}
            </div>
            {rooms.length > 0 && showRooms && (
                <div id={roomsId} className="animate-fade-in border-t border-gray-200 p-2 sm:p-3">
                    <RoomList property={property} rooms={rooms} canEdit={canEdit} onEditRoom={onEditRoom} />
                </div>
            )}
        </article>
    );
}

function RoomList({ property, rooms, canEdit, onEditRoom }) {
    const { t } = useTranslation();

    return (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {rooms.map(room => {
                const tenant = room.active_tenancy?.tenant?.name;
                const use = room.active_tenancy?.business_use;
                const photo = room.images?.[0]?.image_path;
                const size = room.size_sqm !== null && room.size_sqm !== undefined && room.size_sqm !== '' ? Number(room.size_sqm) : null;

                return (
                    <li key={room.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-2.5 transition-shadow hover:shadow-sm">
                        <span className="h-14 w-16 flex-none overflow-hidden rounded-lg bg-gray-100" aria-hidden="true">
                            {photo ? <img src={/^https?:\/\//.test(photo) ? photo : `/storage/${photo}`} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Building2 size={20} className="m-auto mt-4 text-gray-300" />}
                        </span>
                        <Link
                            href={route('properties.units.show', [property.id, room.id])}
                            className="min-w-0 flex-1 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E3B2E]"
                        >
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900">{t('Unit :number', { number: room.unit_number })}</span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ${statusStyles[room.status] || 'bg-gray-100 text-gray-700 ring-gray-500/20'}`}>
                                    {t(room.status ? room.status.charAt(0).toUpperCase() + room.status.slice(1) : '')}
                                </span>
                            </div>
                            <p className="mt-0.5 text-sm text-gray-600">
                                {room.rent_amount ? `${Number(room.rent_amount).toLocaleString()} RWF` : '—'}
                                {size !== null && ` · ${size.toLocaleString(undefined, { maximumFractionDigits: 2 })} m²`}
                            </p>
                            {tenant && (
                                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-600">
                                    <User size={12} aria-hidden="true" /> {tenant}{use ? ` · ${use}` : ''}
                                </p>
                            )}
                        </Link>
                        {canEdit && (
                            <button
                                type="button"
                                onClick={() => onEditRoom?.(room)}
                                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                                aria-label={t('Edit unit :number', { number: room.unit_number })}
                            >
                                <Edit size={15} aria-hidden="true" />
                            </button>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

function UnitDialog({ open, property, floorNumbers, unit, initialFloor, onClose }) {
    const { t } = useTranslation();
    const floorLabel = useFloorLabel();
    const { mounted, closing } = usePresence(open);
    const id = useId();
    const form = useForm({ category_name: '', floor_number: '0', description: '' });
    const { data, setData, errors, processing, clearErrors } = form;
    const [nameError, setNameError] = useState('');
    // Opened from a floor's own "Add unit": that floor is fixed. From the top button: choose it.
    const [floorLocked, setFloorLocked] = useState(false);
    const [ai, setAi] = useState({ busy: false, message: '', tone: 'info' });

    useEffect(() => {
        if (!open) return;
        clearErrors();
        setNameError('');
        setFloorLocked(!unit && initialFloor !== undefined && initialFloor !== null);
        setAi({ busy: false, message: '', tone: 'info' });
        form.setData({
            category_name: unit?.unit_type?.name || '',
            floor_number: String(unit ? unit.floor_number : (initialFloor ?? (floorNumbers.includes(0) ? 0 : floorNumbers[0] ?? 0))),
            description: unit?.description || '',
        });
    }, [open, unit, initialFloor]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => event.key === 'Escape' && !processing && onClose();
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, processing, onClose]);

    if (!mounted) return null;

    const writeDescription = async () => {
        if (!data.category_name.trim()) {
            setNameError(t('Type the category name, for example Office.'));
            document.getElementById(`${id}-category`)?.focus();
            return;
        }
        setAi({ busy: true, message: '', tone: 'info' });
        try {
            const res = await csrfFetch(route('properties.property-units.describe', property.id), {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                body: JSON.stringify({ category_name: data.category_name.trim(), floor_number: data.floor_number }),
            });
            checkDescriptionResponse(res);
            const json = await res.json();
            if (!json?.description) throw new Error('empty');
            setData('description', json.description);
            setAi({ busy: false, message: t('Description written. Read it and change anything you like.'), tone: 'info' });
        } catch (error) {
            setAi({ busy: false, message: descriptionErrorMessage(error, t), tone: 'warning' });
        }
    };

    const submit = (event) => {
        event.preventDefault();
        if (!data.category_name.trim()) {
            setNameError(t('Type the category name, for example Office.'));
            document.getElementById(`${id}-category`)?.focus();
            return;
        }
        form.transform(values => ({ ...values, category_name: values.category_name.trim() }));
        const options = { preserveScroll: true, onSuccess: onClose };
        if (unit) {
            form.put(route('properties.property-units.update', [property.id, unit.id]), options);
        } else {
            form.post(route('properties.property-units.store', property.id), options);
        }
    };

    return createPortal(
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm ${closing ? 'pointer-events-none animate-fade-out' : 'animate-fade-in'}`}
            onMouseDown={(event) => event.target === event.currentTarget && !processing && onClose()}
        >
            <form
                onSubmit={submit}
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${id}-title`}
                className={`w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ${closing ? 'animate-pop-out' : 'animate-pop-in'}`}
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 id={`${id}-title`} className="font-[Sora] text-lg font-bold text-gray-900">{unit ? t('Edit unit') : t('Add unit')}</h2>
                        <p className="mt-1 text-sm text-gray-600">{t('A unit is one category on one floor. You add its rooms next.')}</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                <div className="mt-5 space-y-4">
                    <div>
                        <label htmlFor={`${id}-floor`} className="block text-sm font-medium text-gray-800">{t('Floor')} *</label>
                        <select id={`${id}-floor`} value={data.floor_number} onChange={e => setData('floor_number', e.target.value)} disabled={floorLocked}
                            aria-describedby={floorLocked ? `${id}-floor-help` : undefined}
                            className={`${inputClass} disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-700`} aria-invalid={errors.floor_number ? 'true' : undefined}>
                            {[...floorNumbers].sort((a, b) => a - b).map(floor => (
                                <option key={floor} value={floor}>{floorLabel(floor)}</option>
                            ))}
                        </select>
                        {floorLocked && <p id={`${id}-floor-help`} className="mt-1 text-xs text-gray-500">{t('This unit is added on the floor you chose.')}</p>}
                        {errors.floor_number && <p className="mt-1 text-sm text-red-600" role="alert">{errors.floor_number}</p>}
                    </div>

                    <div>
                        <label htmlFor={`${id}-category`} className="block text-sm font-medium text-gray-800">{t('Category name')} *</label>
                        <input
                            id={`${id}-category`}
                            type="text"
                            value={data.category_name}
                            onChange={e => { setData('category_name', e.target.value); setNameError(''); }}
                            onBlur={() => !data.category_name.trim() && setNameError(t('Type the category name, for example Office.'))}
                            maxLength={100}
                            autoComplete="off"
                            placeholder={t('e.g. Office, Restaurant, Shop')}
                            aria-invalid={nameError || errors.category_name ? 'true' : undefined}
                            aria-describedby={`${id}-category-help`}
                            className={inputClass}
                        />
                        <p id={`${id}-category-help`} className="mt-1 text-xs text-gray-500">{t('Type what this floor space is used for. You add its rooms next.')}</p>
                        {(nameError || errors.category_name || errors.unit_type_id) && (
                            <p className="mt-1 text-sm text-red-600" role="alert">{nameError || errors.category_name || errors.unit_type_id}</p>
                        )}
                    </div>

                    <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <label htmlFor={`${id}-description`} className="block text-sm font-medium text-gray-800">
                                {t('Description')} <span className="font-normal text-gray-500">({t('optional')})</span>
                            </label>
                            <button
                                type="button"
                                onClick={writeDescription}
                                disabled={ai.busy}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-[#0E3B2E]/30 bg-[#0E3B2E]/5 px-3 py-1.5 text-xs font-semibold text-[#0E3B2E] transition-colors hover:bg-[#0E3B2E]/10 disabled:opacity-60"
                            >
                                {ai.busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Sparkles size={13} aria-hidden="true" />}
                                {ai.busy ? t('Writing...') : t('Write with AI')}
                            </button>
                        </div>
                        <textarea id={`${id}-description`} rows={4} value={data.description} onChange={e => setData('description', e.target.value)} maxLength={2000} className={inputClass} />
                        {ai.message && <p aria-live="polite" className={`mt-1 text-xs ${ai.tone === 'warning' ? 'text-amber-800' : 'text-gray-600'}`}>{ai.message}</p>}
                        {errors.description && <p className="mt-1 text-sm text-red-600" role="alert">{errors.description}</p>}
                    </div>
                </div>

                <div className="mt-6 flex gap-3">
                    <button type="button" onClick={onClose} disabled={processing} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60">
                        {t('Cancel')}
                    </button>
                    <button type="submit" disabled={processing || closing} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#124B3A] disabled:opacity-60">
                        {processing && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                        {unit ? t('Save unit') : t('Add unit')}
                    </button>
                </div>
            </form>
        </div>,
        document.body,
    );
}

/**
 * Add or edit a room without leaving the property page.
 */
function RoomDialog({ open, property, room, unitId, floors = [], floor = null, onClose }) {
    const { t } = useTranslation();
    const { mounted, closing } = usePresence(open);
    const id = useId();
    // Keep showing the room while the dialog animates out.
    const shown = useMemo(() => ({ room, unitId, floor }), [open]);
    const floorLabel = useFloorLabel();

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => event.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = overflow;
        };
    }, [open, onClose]);

    if (!mounted) return null;

    const propertyUnits = (property.property_units || []).map(u => ({
        id: u.id, unit_type_id: u.unit_type_id, category: u.unit_type?.name || '', floor_number: u.floor_number,
    }));

    return createPortal(
        <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6 ${closing ? 'pointer-events-none animate-fade-out' : 'animate-fade-in'}`}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${id}-title`}
                className={`flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${closing ? 'animate-pop-out' : 'animate-pop-in'}`}
            >
                <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
                    <div>
                        <h2 id={`${id}-title`} className="font-[Sora] text-lg font-bold text-gray-900">
                            {shown.room ? t('Edit unit :number', { number: shown.room.unit_number }) : t('Add unit')}
                        </h2>
                        <p className="mt-0.5 text-sm text-gray-600">{property.name}{shown.floor !== null && shown.floor !== undefined ? ` · ${floorLabel(shown.floor)}` : ''}</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>
                <RoomForm
                    key={shown.room?.id ?? `new-${shown.unitId}-${shown.floor}`}
                    compact
                    property={property}
                    propertyUnits={propertyUnits}
                    room={shown.room}
                    initialUnitId={shown.unitId}
                    floors={shown.unitId ? null : floors}
                    floorNumber={shown.floor}
                    lockUnit
                    onSaved={onClose}
                    onCancel={onClose}
                />
            </div>
        </div>,
        document.body,
    );
}
