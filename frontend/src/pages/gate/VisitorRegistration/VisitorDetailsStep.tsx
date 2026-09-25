import { Card } from '../../../components/Card';
import { Input } from '../../../components/Input';
import { Select } from '../../../components/Select';
import { IconUser, IconMobile, IconMapPin, IconBuilding } from '../../../components/icons';
import { VISITOR_TYPES } from '../../../utils/constants';
import type { VisitorType } from '../../../types';

export interface VisitorDetailsValues {
  name: string;
  mobile: string;
  email: string;
  address: string;
  district: string;
  constituency: string;
  visitorType: VisitorType;
}

/** Step 2 - who is visiting. Two columns on desktop, one on a phone. */
export function VisitorDetailsStep({
  values,
  errors,
  onChange,
}: {
  values: VisitorDetailsValues;
  errors: Record<string, string>;
  onChange: <K extends keyof VisitorDetailsValues>(field: K, value: VisitorDetailsValues[K]) => void;
}) {
  return (
    <Card
      step="02"
      title="Visitor details"
      subtitle="Who is visiting, and how to reach them."
      enterDelay={0}
    >
      <div className="form-grid-2">
        <Input
          label="Full name"
          required
          value={values.name}
          onChange={(e) => onChange('name', e.target.value)}
          error={errors.name}
          placeholder="As printed on the ID"
          icon={<IconUser size={16} />}
          autoComplete="off"
        />
        <Input
          label="Mobile number"
          required
          value={values.mobile}
          onChange={(e) => onChange('mobile', e.target.value)}
          error={errors.mobile}
          placeholder="10-digit mobile"
          inputMode="numeric"
          icon={<IconMobile size={16} />}
          autoComplete="off"
        />
        <Input
          label="Email"
          type="email"
          value={values.email}
          onChange={(e) => onChange('email', e.target.value)}
          error={errors.email}
          placeholder="Optional"
          hint="Used only to email the visitor pass."
          autoComplete="off"
        />
        <Input
          label="Address"
          value={values.address}
          onChange={(e) => onChange('address', e.target.value)}
          placeholder="Optional"
          icon={<IconMapPin size={16} />}
          autoComplete="off"
        />
        <Input
          label="District"
          value={values.district}
          onChange={(e) => onChange('district', e.target.value)}
          icon={<IconBuilding size={16} />}
          autoComplete="off"
        />
        <Input
          label="Constituency"
          value={values.constituency}
          onChange={(e) => onChange('constituency', e.target.value)}
          placeholder="Assembly constituency"
          autoComplete="off"
        />
        <Select
          label="Visitor type"
          required
          value={values.visitorType}
          onChange={(e) => onChange('visitorType', e.target.value as VisitorType)}
          options={VISITOR_TYPES.map((t) => ({ value: t, label: t }))}
        />
      </div>
    </Card>
  );
}
