import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Image as ImageIcon, Trash2 } from 'lucide-react';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { toast } from '@/components/toast/toastStore';
import { initialsOf, avatarColorFor } from '@/core/utils/avatar';
import { rosterRepo } from '@/data/hostRosterRepo';
import type { RosterPlayerDoc } from '@/types/player';

type Props = {
  open: boolean;
  onClose: () => void;
  hostId: string;
  /** null => create. */
  player: RosterPlayerDoc | null;
  onDeleted?: () => void;
};

const AVATAR_EMOJIS = ['🏸', '🎾', '🏓', '🎱', '⚡', '🔥', '🏆', '👑', '🦁', '🎯', '🚀', '🌟'];

function Form({ onClose, hostId, player, onDeleted }: Omit<Props, 'open'>) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(player?.name ?? '');
  const [nickname, setNickname] = useState(player?.nickname ?? '');
  const [phone, setPhone] = useState(player?.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string>(player?.avatarUrl ?? '');
  const [guest, setGuest] = useState(player?.isGuest ?? false);
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);
  const [touched, setTouched] = useState(false);

  const cleanName = name.trim();
  const nameError = touched && cleanName.length === 0 ? t('roster.newPlayer.nameRequired') : null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setAvatarUrl(dataUrl);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const save = () => {
    setTouched(true);
    if (cleanName.length === 0) return;
    const finalAvatar = avatarUrl.trim() || null;
    if (player) {
      rosterRepo.update(hostId, player.id, {
        name: cleanName,
        nickname: nickname.trim() || null,
        avatarUrl: finalAvatar,
        phone: phone.trim() || null,
        isGuest: guest,
      });
    } else {
      rosterRepo.create(hostId, {
        name: cleanName,
        nickname,
        avatarUrl: finalAvatar,
        phone,
        isGuest: guest,
      });
    }
    onClose();
  };

  return (
    <>
      <form
        id="player-form"
        className="flex flex-col gap-4 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="relative">
            <Avatar
              name={cleanName || 'Pemain'}
              initials={initialsOf(cleanName || 'P')}
              color={player?.avatarColor ?? avatarColorFor(cleanName || 'P')}
              src={avatarUrl}
              size="lg"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full border border-line bg-surface-2 text-ink shadow-sm"
              aria-label="Upload Foto Profil"
            >
              <Camera size={14} aria-hidden="true" />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleImageUpload}
          />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<ImageIcon size={14} aria-hidden="true" />}
              onClick={() => fileInputRef.current?.click()}
            >
              {t('roster.form.uploadPhoto')}
            </Button>
            {avatarUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-danger"
                leftIcon={<Trash2 size={14} aria-hidden="true" />}
                onClick={() => setAvatarUrl('')}
              >
                {t('roster.form.removePhoto')}
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap justify-center gap-1.5 px-2">
            {AVATAR_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`grid size-9 place-items-center rounded-full text-base transition-transform ${avatarUrl === emoji ? 'border-2 border-primary scale-110 bg-surface-2' : 'border border-line hover:scale-105'}`}
                onClick={() => setAvatarUrl(avatarUrl === emoji ? '' : emoji)}
                aria-label={`Pilih avatar ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <TextField label={t('roster.newPlayer.nameLabel')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('roster.newPlayer.namePlaceholder')} error={nameError} maxLength={40} autoComplete="off" />
        <TextField label={t('roster.newPlayer.nicknameLabel')} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={t('roster.newPlayer.nicknamePlaceholder')} maxLength={20} autoComplete="off" />
        <TextField label={t('roster.newPlayer.phoneLabel')} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('roster.newPlayer.phonePlaceholder')} type="tel" inputMode="tel" maxLength={20} autoComplete="off" />
        <label className="pressable flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-line bg-surface-2 px-4">
          <input type="checkbox" checked={guest} onChange={(e) => setGuest(e.target.checked)} className="size-5 accent-[var(--c-primary)]" />
          <span className="text-[15px]">{t('roster.newPlayer.guest')}</span>
        </label>
      </form>

      <div className="mt-4 flex flex-col gap-2">
        <Button type="submit" form="player-form" size="lg" fullWidth>
          {player ? t('roster.editPlayer.cta') : t('roster.newPlayer.cta')}
        </Button>
        {player ? (
          <div className="grid grid-cols-2 gap-2">
            {player.archivedAt === null ? (
              <Button variant="secondary" onClick={() => setConfirm('archive')}>
                {t('common.archive')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  rosterRepo.restore(hostId, player.id);
                  onClose();
                }}
              >
                {t('common.restore')}
              </Button>
            )}
            <Button variant="ghost" className="text-danger" onClick={() => setConfirm('delete')}>
              {t('common.delete')}
            </Button>
          </div>
        ) : null}
      </div>

      {player ? (
        <>
          <ConfirmDialog
            open={confirm === 'archive'}
            title={t('roster.editPlayer.archiveConfirm', { name: player.name })}
            body={t('roster.editPlayer.archiveDetail')}
            confirmLabel={t('common.archive')}
            cancelLabel={t('common.cancel')}
            onCancel={() => setConfirm(null)}
            onConfirm={() => {
              rosterRepo.archive(hostId, player.id);
              toast.undo(t('roster.archivedToast', { name: player.name }), t('common.undo'), () => rosterRepo.restore(hostId, player.id));
              setConfirm(null);
              onClose();
            }}
          />
          <ConfirmDialog
            open={confirm === 'delete'}
            destructive
            title={t('roster.editPlayer.deleteConfirm', { name: player.name })}
            body={t('roster.editPlayer.deleteDetail')}
            confirmLabel={t('common.delete')}
            cancelLabel={t('common.cancel')}
            onCancel={() => setConfirm(null)}
            onConfirm={() => {
              void rosterRepo.hardDelete(hostId, player.id);
              setConfirm(null);
              onClose();
              onDeleted?.();
            }}
          />
        </>
      ) : null}
    </>
  );
}

/** Add / edit sheet. The inner form remounts per open so fields never show stale values. */
export function PlayerFormSheet(props: Props) {
  const { t } = useTranslation();
  const { open, onClose, player } = props;
  return (
    <Sheet open={open} onClose={onClose} title={player ? t('roster.editPlayer.title') : t('roster.newPlayer.title')} closeLabel={t('common.close')}>
      {open ? <Form key={player?.id ?? 'new'} {...props} /> : null}
    </Sheet>
  );
}
