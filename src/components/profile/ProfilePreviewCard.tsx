// ── Module 10: Live Profile Preview Card ─────────────────────────────────────
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Mail, Phone, MapPin, FileText, Eye } from 'lucide-react';
import { getImageUrl } from '@/lib/api';
import { ProfileCompletionLinear } from './ProfileCompletionBar';
import type { ProfileData } from './ProfileCompletionBar';

interface Props {
  data:     ProfileData & { email: string };
  /** True when user is actively editing — animates a subtle highlight */
  editing?: boolean;
}

export function ProfilePreviewCard({ data, editing }: Props) {
  const initials = (data.name || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const locationParts = [data.city, data.state].filter(Boolean);
  const addressParts  = [data.street, ...locationParts, data.zipCode].filter(Boolean);

  return (
    <Card
      className={
        editing
          ? 'border-primary/40 shadow-sm ring-1 ring-primary/20 transition-all'
          : 'transition-all'
      }
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <Eye className="w-3.5 h-3.5" />
          Live Preview
          {editing && (
            <Badge variant="outline" className="ml-auto text-xs border-primary/30 text-primary bg-primary/5">
              Updating…
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          <Avatar className="w-14 h-14 ring-2 ring-background shadow">
            {data.avatar ? (
              <AvatarImage
                src={getImageUrl(data.avatar)}
                alt={data.name}
                className="object-cover"
              />
            ) : null}
            <AvatarFallback className="text-base font-semibold bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-foreground truncate ${!data.name ? 'text-muted-foreground italic' : ''}`}>
              {data.name || 'Your name'}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="secondary" className="text-xs">Verified Customer</Badge>
            </div>
          </div>
        </div>

        {/* Bio */}
        {data.bio && (
          <>
            <Separator />
            <div className="flex gap-2 items-start">
              <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{data.bio}</p>
            </div>
          </>
        )}

        <Separator />

        {/* Contact details */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <Mail className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <span className="text-foreground truncate">{data.email || '—'}</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Phone className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <span className={data.phone ? 'text-foreground' : 'italic text-muted-foreground'}>
              {data.phone || 'No phone added'}
            </span>
          </div>

          <div className="flex items-start gap-2 text-xs">
            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <span className={addressParts.length > 0 ? 'text-foreground' : 'italic text-muted-foreground'}>
              {addressParts.length > 0 ? addressParts.join(', ') : 'No address added'}
            </span>
          </div>
        </div>

        <Separator />

        {/* Completion bar */}
        <ProfileCompletionLinear data={data} />
      </CardContent>
    </Card>
  );
}
