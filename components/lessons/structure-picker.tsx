"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { GrammarStructure, StructureFamily, StructureRole } from "@/lib/grammar/types";
import { STRUCTURE_FAMILY_LABELS_DE, STRUCTURE_ROLE_LABELS_DE } from "@/lib/grammar/types";
import { formatHskLevel, HSK_LEVELS, type HskLevel } from "@/lib/hsk-level";
import {
  familiesForRole,
  lessonMaxCatalogHsk,
  structuresForFamily,
} from "@/lib/lessons/selection";
import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { useMemo, useState } from "react";

type StructurePickerProps = {
  structures: GrammarStructure[];
  enabledHskLevels: HskLevel[];
  enabledRoles: StructureRole[];
  enabledFamilies: StructureFamily[];
  excludedStructureIds: number[];
  onMaxHskChange: (max: HskLevel | null) => void;
  onToggleRole: (role: StructureRole, enabled: boolean) => void;
  onToggleFamily: (family: StructureFamily, enabled: boolean) => void;
  onToggleStructure: (id: number, selected: boolean) => void;
  disabled?: boolean;
};

const ROLES: StructureRole[] = ["core", "focus"];

export function StructurePicker({
  structures,
  enabledHskLevels,
  enabledRoles,
  enabledFamilies,
  excludedStructureIds,
  onMaxHskChange,
  onToggleRole,
  onToggleFamily,
  onToggleStructure,
  disabled = false,
}: StructurePickerProps) {
  const excluded = useMemo(() => new Set(excludedStructureIds), [excludedStructureIds]);
  const roles = useMemo(() => new Set(enabledRoles), [enabledRoles]);
  const families = useMemo(() => new Set(enabledFamilies), [enabledFamilies]);
  const maxHsk = lessonMaxCatalogHsk(enabledHskLevels);
  const maxUi = (maxHsk !== null && maxHsk >= 7 ? 9 : maxHsk) as HskLevel | null;

  const filtered = useMemo(() => {
    if (maxHsk === null) return structures;
    return structures.filter((structure) => structure.hsk_level <= maxHsk);
  }, [structures, maxHsk]);

  const [openRoles, setOpenRoles] = useState<StructureRole[]>(() => [...enabledRoles]);
  const [openFamilies, setOpenFamilies] = useState<string[]>([]);

  return (
    <div className="flex flex-col gap-3" role="group" aria-label="Grammatikstrukturen nach Rolle">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground text-xs">HSK-Maximum</span>
        <select
          className="border-border/60 bg-background h-8 rounded-md border px-2 text-sm outline-none disabled:opacity-50"
          value={maxUi ?? ""}
          disabled={disabled}
          onChange={(event) => {
            const raw = event.target.value;
            if (!raw) {
              onMaxHskChange(null);
              return;
            }
            onMaxHskChange(Number(raw) as HskLevel);
          }}
          aria-label="HSK-Maximum"
        >
          <option value="">— wählen —</option>
          {HSK_LEVELS.map((level) => (
            <option key={level} value={level}>
              {formatHskLevel(level)}
            </option>
          ))}
        </select>
      </label>

      {ROLES.map((role) => {
        const roleStructures = filtered.filter((structure) => structure.role === role);
        const roleEnabled = roles.has(role);
        const roleFamilies = familiesForRole(filtered, role);
        const selectedCount = roleStructures.filter(
          (structure) =>
            roleEnabled &&
            structure.family &&
            families.has(structure.family) &&
            !excluded.has(structure.id),
        ).length;
        const isOpen = openRoles.includes(role);

        return (
          <Collapsible
            key={role}
            open={isOpen}
            onOpenChange={(nextOpen) => {
              setOpenRoles((current) =>
                nextOpen ? [...current, role] : current.filter((item) => item !== role),
              );
            }}
          >
            <div className="border-border/60 rounded-lg border">
              <div className="flex items-center gap-2 px-2.5 py-1.5">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={roleEnabled}
                    disabled={disabled || roleStructures.length === 0 || maxHsk === null}
                    onChange={(event) => {
                      onToggleRole(role, event.target.checked);
                      if (event.target.checked) {
                        setOpenRoles((current) =>
                          current.includes(role) ? current : [...current, role],
                        );
                      }
                    }}
                    aria-label={`${STRUCTURE_ROLE_LABELS_DE[role]} auswählen`}
                    className="border-border/60 accent-foreground size-3.5 cursor-pointer rounded-sm disabled:cursor-not-allowed"
                  />
                  <span className="font-medium">{STRUCTURE_ROLE_LABELS_DE[role]}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {roleStructures.length === 0
                      ? "keine Strukturen"
                      : `${selectedCount}/${roleStructures.length}`}
                  </span>
                </label>
                <CollapsibleTrigger
                  disabled={roleStructures.length === 0}
                  className="text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-md disabled:opacity-40"
                  aria-label={`${STRUCTURE_ROLE_LABELS_DE[role]} anzeigen`}
                >
                  <ChevronDownIcon
                    className={cn("size-4 transition-transform", isOpen && "rotate-180")}
                  />
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="data-open:animate-in overflow-hidden">
                <div className="border-border/50 max-h-72 space-y-1.5 overflow-y-auto border-t px-2 py-2">
                  {roleFamilies.map((family) => {
                    const familyStructures = structuresForFamily(filtered, role, family);
                    const familyEnabled = roleEnabled && families.has(family);
                    const familySelected = familyStructures.filter(
                      (structure) => familyEnabled && !excluded.has(structure.id),
                    ).length;
                    const familyKey = `${role}:${family}`;
                    const familyOpen = openFamilies.includes(familyKey);

                    return (
                      <Collapsible
                        key={familyKey}
                        open={familyOpen}
                        onOpenChange={(nextOpen) => {
                          setOpenFamilies((current) =>
                            nextOpen
                              ? [...current, familyKey]
                              : current.filter((item) => item !== familyKey),
                          );
                        }}
                      >
                        <div className="rounded-md border border-transparent hover:border-border/40">
                          <div className="flex items-center gap-2 px-1.5 py-1">
                            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={familyEnabled}
                                disabled={disabled || !roleEnabled}
                                onChange={(event) =>
                                  onToggleFamily(family, event.target.checked)
                                }
                                aria-label={`${STRUCTURE_FAMILY_LABELS_DE[family]} auswählen`}
                                className="border-border/60 accent-foreground size-3.5 cursor-pointer rounded-sm disabled:cursor-not-allowed"
                              />
                              <span className={cn(!roleEnabled && "opacity-50")}>
                                {STRUCTURE_FAMILY_LABELS_DE[family]}
                              </span>
                              <span className="text-muted-foreground text-xs">
                                {familySelected}/{familyStructures.length}
                              </span>
                            </label>
                            <CollapsibleTrigger
                              className="text-muted-foreground hover:text-foreground inline-flex size-6 items-center justify-center rounded-md"
                              aria-label={`${STRUCTURE_FAMILY_LABELS_DE[family]} Regeln`}
                            >
                              <ChevronDownIcon
                                className={cn(
                                  "size-3.5 transition-transform",
                                  familyOpen && "rotate-180",
                                )}
                              />
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent>
                            <ul className="space-y-1 px-1.5 pb-1.5">
                              {familyStructures.map((structure) => {
                                const selected =
                                  familyEnabled && !excluded.has(structure.id);
                                return (
                                  <li key={structure.id}>
                                    <label
                                      className={cn(
                                        "flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-sm",
                                        !familyEnabled && "opacity-50",
                                      )}
                                    >
                                      <input
                                        type="checkbox"
                                        className="border-border/60 accent-foreground mt-0.5 size-3.5 shrink-0 cursor-pointer rounded-sm disabled:cursor-not-allowed"
                                        checked={selected}
                                        disabled={disabled || !familyEnabled}
                                        onChange={(event) =>
                                          onToggleStructure(
                                            structure.id,
                                            event.target.checked,
                                          )
                                        }
                                      />
                                      <span className="min-w-0">
                                        <span className="block leading-snug">
                                          {structure.pattern}
                                        </span>
                                        {structure.hint_de ? (
                                          <span className="text-foreground/80 block text-xs leading-snug">
                                            {structure.hint_de}
                                          </span>
                                        ) : null}
                                        <span className="text-muted-foreground block text-xs">
                                          {formatHskLevel(
                                            structure.hsk_level >= 7
                                              ? 9
                                              : (structure.hsk_level as HskLevel),
                                          )}
                                        </span>
                                      </span>
                                    </label>
                                  </li>
                                );
                              })}
                            </ul>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
