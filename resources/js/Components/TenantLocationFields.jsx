import { useEffect, useState } from 'react';

const locationFields = ['province_id', 'district_id', 'sector_id'];

export default function TenantLocationFields({ data, setData, errors, t }) {
    const [provinces, setProvinces] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        let cancelled = false;

        fetch('/api/provinces')
            .then(response => {
                if (!response.ok) throw new Error('Unable to load provinces.');
                return response.json();
            })
            .then(items => {
                if (!cancelled) setProvinces(items);
            })
            .catch(() => {
                if (!cancelled) setLoadError(t('Unable to load locations. Please try again.'));
            });

        return () => { cancelled = true; };
    }, [t]);

    useEffect(() => {
        if (!data.province_id) {
            setDistricts([]);
            return undefined;
        }

        let cancelled = false;

        fetch(`/api/districts/${data.province_id}`)
            .then(response => {
                if (!response.ok) throw new Error('Unable to load districts.');
                return response.json();
            })
            .then(items => {
                if (!cancelled) setDistricts(items);
            })
            .catch(() => {
                if (!cancelled) setLoadError(t('Unable to load locations. Please try again.'));
            });

        return () => { cancelled = true; };
    }, [data.province_id, t]);

    useEffect(() => {
        if (!data.district_id) {
            setSectors([]);
            return undefined;
        }

        let cancelled = false;

        fetch(`/api/sectors/${data.district_id}`)
            .then(response => {
                if (!response.ok) throw new Error('Unable to load sectors.');
                return response.json();
            })
            .then(items => {
                if (!cancelled) setSectors(items);
            })
            .catch(() => {
                if (!cancelled) setLoadError(t('Unable to load locations. Please try again.'));
            });

        return () => { cancelled = true; };
    }, [data.district_id, t]);

    const updateLocation = (field, value) => {
        const next = {
            province_id: data.province_id,
            district_id: data.district_id,
            sector_id: data.sector_id,
        };

        if (field === 'province_id') {
            next.province_id = value;
            next.district_id = '';
            next.sector_id = '';
        } else if (field === 'district_id') {
            next.district_id = value;
            next.sector_id = '';
        } else {
            next.sector_id = value;
        }

        setData(current => ({
            ...current,
            ...Object.fromEntries(locationFields.map(name => [name, next[name]])),
        }));
    };

    const selectClass = 'mt-1 w-full rounded-xl border-gray-200 text-sm';

    return (
        <div className="grid gap-3 sm:grid-cols-3 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">
                {t('Province')}
                <select required value={data.province_id} onChange={event => updateLocation('province_id', event.target.value)} className={selectClass}>
                    <option value="">{t('Select Province')}</option>
                    {provinces.map(province => <option key={province.id} value={province.id}>{province.name}</option>)}
                </select>
                {errors.province_id && <span className="mt-1 block text-xs text-red-600">{errors.province_id}</span>}
            </label>
            <label className="text-sm font-medium text-gray-700">
                {t('District')}
                <select required disabled={!data.province_id} value={data.district_id} onChange={event => updateLocation('district_id', event.target.value)} className={selectClass}>
                    <option value="">{t('Select District')}</option>
                    {districts.map(district => <option key={district.id} value={district.id}>{district.name}</option>)}
                </select>
                {errors.district_id && <span className="mt-1 block text-xs text-red-600">{errors.district_id}</span>}
            </label>
            <label className="text-sm font-medium text-gray-700">
                {t('Sector')}
                <select required disabled={!data.district_id} value={data.sector_id} onChange={event => updateLocation('sector_id', event.target.value)} className={selectClass}>
                    <option value="">{t('Select Sector')}</option>
                    {sectors.map(sector => <option key={sector.id} value={sector.id}>{sector.name}</option>)}
                </select>
                {errors.sector_id && <span className="mt-1 block text-xs text-red-600">{errors.sector_id}</span>}
            </label>
            {loadError && <p role="alert" className="text-xs text-red-600 sm:col-span-3">{loadError}</p>}
        </div>
    );
}
