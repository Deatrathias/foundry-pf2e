import * as R from "remeda";
import { getActionAnnotation } from "./item";
import { localeCompare } from "./localize";
import { getActiveModule } from "./module";
import { spellSlotGroupIdToNumber } from "./pf2e";

async function getSummarizedSpellsDataForRender(
    actor: CreaturePF2e,
    sortByType: boolean,
    staffLabels: { staff: string; charges: string },
    entries?: SpellcastingSheetData[]
) {
    entries ??= await Promise.all(
        actor.spellcasting.collections.map((spells) => spells.entry.getSheetData({ spells }))
    );

    const focusPool = actor.system.resources?.focus ?? { value: 0, max: 0 };
    const pf2eDailies = getActiveModule("pf2e-dailies");

    const spells: SummarizedSpell[][] = [];
    const labels: string[] = [];

    let hasFocusCantrip = false;

    for (const entry of entries) {
        const entryId = entry.id;
        const entryDc = entry.statistic?.dc.value;
        const entryTooltip = entryDc
            ? `${entry.name} - ${game.i18n.format("PF2E.DCWithValue", { dc: entryDc, text: "" })}`
            : entry.name;
        const isFocus = entry.isFocusPool;
        const isRitual = entry.isRitual;
        const isCharges = entry.category === "charges";
        const isStaff = entry.isStaff;
        const isInnate = entry.isInnate;
        const isPrepared = entry.isPrepared;
        const isSpontaneous = entry.isSpontaneous;
        const isFlexible = entry.isFlexible;

        const item = entry.isEphemeral
            ? actor.items.get<ConsumablePF2e<CreaturePF2e>>(entryId.split("-")[0])
            : undefined;

        const consumable = entry.category === "items" ? item : undefined;

        for (const group of entry.groups) {
            if (!group.active.length || group.uses?.max === 0) continue;

            const groupNumber = spellSlotGroupIdToNumber(group.id);
            const slotSpells: SummarizedSpell[] = [];
            const isCantrip = group.id === "cantrips";
            const isBroken = !isCantrip && isCharges && !pf2eDailies;
            const groupUses =
                typeof group.uses?.value === "number" ? (group.uses as ValueAndMax) : undefined;

            for (let slotId = 0; slotId < group.active.length; slotId++) {
                const active = group.active[slotId];
                if (!active?.spell || active.uses?.max === 0) continue;

                const { spell } = active;
                const spellId = spell.id;
                const uses =
                    isCantrip || isFocus || consumable || (isPrepared && !isFlexible)
                        ? undefined
                        : isCharges && !isBroken
                        ? entry.uses
                        : active.uses ?? groupUses;

                slotSpells.push({
                    name: spell.name,
                    itemId: spellId,
                    entryId,
                    groupId: group.id,
                    slotId,
                    parentId: item?.id,
                    action: spell.system.time.value,
                    castRank: active.castRank ?? spell.rank,
                    expended: isFocus ? !isCantrip && focusPool.value <= 0 : active.expended,
                    img: spell.img,
                    range: spell.system.range.value || "-&nbsp;",
                    rank: spell.rank,
                    entryName: entry.name,
                    entryDc,
                    entryTooltip,
                    consumable,
                    isBroken,
                    isFocus,
                    isRitual,
                    isCharges,
                    isStaff,
                    isInnate,
                    isPrepared,
                    isSpontaneous,
                    isFlexible,
                    annotation: item ? getActionAnnotation(item) : undefined,
                    uses: uses
                        ? {
                              ...uses,
                              input: isStaff
                                  ? ""
                                  : isCharges
                                  ? "system.slots.slot1.value"
                                  : isInnate
                                  ? "system.location.uses.value"
                                  : `system.slots.slot${groupNumber}.value`,
                              itemId: isStaff ? "" : isInnate ? spellId : entryId,
                          }
                        : undefined,
                    order: isCharges
                        ? 0
                        : isPrepared
                        ? 1
                        : isFocus
                        ? 2
                        : isInnate
                        ? 3
                        : isSpontaneous
                        ? 4
                        : 5,
                    category: consumable
                        ? `PF2E.Item.Consumable.Category.${consumable.category}`
                        : isStaff
                        ? staffLabels.staff
                        : isCharges
                        ? staffLabels.charges
                        : isInnate
                        ? "PF2E.PreparationTypeInnate"
                        : isSpontaneous
                        ? "PF2E.PreparationTypeSpontaneous"
                        : isFlexible
                        ? "PF2E.SpellFlexibleLabel"
                        : isFocus
                        ? "PF2E.TraitFocus"
                        : "PF2E.SpellPreparedLabel",
                });
            }

            if (slotSpells.length) {
                if (isFocus) {
                    if (isCantrip) {
                        hasFocusCantrip = true;
                    } else {
                        const focusGroup = (spells[12] ??= []);
                        focusGroup.push(...slotSpells);
                        continue;
                    }
                } else if (isRitual) {
                    const ritualGroup = (spells[13] ??= []);
                    ritualGroup.push(...slotSpells);
                    continue;
                }

                labels[groupNumber] ??= group.label;
                const spellsGroup = (spells[groupNumber] ??= []);
                spellsGroup.push(...slotSpells);
            }
        }
    }

    if (spells.length) {
        const orderSort = (a: SummarizedSpell, b: SummarizedSpell) =>
            a.order === b.order ? localeCompare(a.name, b.name) : a.order - b.order;
        const nameSort = (a: SummarizedSpell, b: SummarizedSpell) => localeCompare(a.name, b.name);
        const sort = sortByType ? orderSort : nameSort;

        for (let i = 0; i < spells.length; i++) {
            const entry = spells[i];
            if (!entry || i > 11) continue;
            entry.sort(sort);
        }
    }

    labels[12] = "PF2E.Focus.Spells";
    labels[13] = "PF2E.Actor.Character.Spellcasting.Tab.Rituals";

    return {
        labels,
        spells,
        focusPool,
        isOwner: actor.isOwner,
        hasFocusCantrip,
    };
}

function getActorMaxRank(actor: CreaturePF2e) {
    return Math.max(1, Math.ceil(actor.level / 2)) as OneToTen;
}

function getHighestSpellcastingStatistic(actor: NPCPF2e | CharacterPF2e) {
    const entries = (actor as CreaturePF2e).spellcasting?.spellcastingFeatures;
    if (!entries?.length) return;

    const classAttribute = actor.isOfType("character") ? actor.classDC?.attribute : null;
    const groupedEntries = R.groupBy(entries, (entry) => entry.statistic.mod);

    const highestMod = R.pipe(
        groupedEntries,
        R.keys(),
        R.sortBy([(x) => Number(x), "desc"]),
        R.first()
    );

    const highestResults = groupedEntries[Number(highestMod)].map((entry) => ({
        tradition: entry.tradition,
        statistic: entry.statistic,
    }));

    if (highestResults.length === 1 || !classAttribute) {
        return highestResults[0];
    }

    return (
        highestResults.find((entry) => entry.statistic.attribute === classAttribute) ||
        highestResults[0]
    );
}

function getHighestSyntheticStatistic(actor: NPCPF2e | CharacterPF2e, withClassDcs = true) {
    const isCharacter = actor.isOfType("character");
    const synthetics = Array.from(actor.synthetics.statistics.values());
    const statistics =
        withClassDcs && isCharacter
            ? [...synthetics, ...Object.values(actor.classDCs)]
            : synthetics;

    if (!statistics.length) return;

    const classStatistic = isCharacter ? actor.classDC : null;
    const groupedStatistics = R.groupBy(statistics, R.prop("mod"));
    const highestMod = R.pipe(
        R.keys(groupedStatistics),
        R.firstBy([R.identity(), "desc"])
    ) as unknown as number;

    if (classStatistic && highestMod && classStatistic.mod === highestMod) {
        return classStatistic;
    }

    return groupedStatistics[highestMod][0];
}

function createSpellcastingWithHighestStatisticSource(
    actor: NPCPF2e | CharacterPF2e,
    {
        name,
        category,
        flags,
        showSlotlessRanks,
        sort,
        withClassDcs,
    }: CreateSpellcastingSourceWithHighestStatistic
) {
    const highestEntry = getHighestSpellcastingStatistic(actor);
    const highestSynthetic = getHighestSyntheticStatistic(actor, withClassDcs);

    const [tradition, statistic] =
        highestEntry && (!highestSynthetic || highestEntry.statistic.mod >= highestSynthetic.mod)
            ? [highestEntry.tradition, highestEntry.statistic]
            : highestSynthetic
            ? [null, highestSynthetic]
            : [null, null];

    if (!statistic) return;

    return createSpellcastingSource({
        name,
        sort,
        flags,
        category,
        showSlotlessRanks,
        tradition: tradition ?? "arcane",
        attribute: statistic.attribute,
        proficiencyRank: statistic.rank ?? 1,
        proficiencySlug: statistic === highestSynthetic ? statistic.slug : undefined,
    });
}

function createSpellcastingSource({
    name,
    category,
    attribute,
    flags,
    proficiencyRank,
    proficiencySlug,
    showSlotlessRanks,
    sort,
    tradition,
}: CreateSpellcastingSource): PreCreate<SpellcastingEntrySource> {
    return {
        type: "spellcastingEntry",
        name,
        sort: sort ?? 0,
        system: {
            ability: {
                value: (!proficiencySlug && attribute) || "",
            },
            prepared: {
                value: category ?? "innate",
            },
            showSlotlessLevels: {
                value: showSlotlessRanks ?? false,
            },
            proficiency: {
                value: proficiencyRank ?? 1,
                slug: proficiencySlug ?? "",
            },
            tradition: {
                value: tradition ?? "arcane",
            },
        },
        flags: flags ?? {},
    };
}

type CreateSpellcastingSource = {
    name: string;
    category?: SpellcastingCategory;
    sort?: number;
    attribute?: AttributeString | null;
    proficiencySlug?: string;
    showSlotlessRanks?: boolean;
    proficiencyRank?: ZeroToFour | null;
    tradition?: MagicTradition;
    flags?: Record<string, any>;
};

type CreateSpellcastingSourceWithHighestStatistic = Omit<
    CreateSpellcastingSource,
    "attribute" | "proficiencyRank" | "proficiencySlug" | "tradition"
> & {
    withClassDcs?: boolean;
};

type SummarizedSpell = {
    itemId: string;
    entryId: string;
    entryDc: number | undefined;
    entryTooltip: string;
    groupId: SpellSlotGroupId;
    castRank: number;
    slotId: number | undefined;
    parentId: string | undefined;
    expended: boolean | undefined;
    name: string;
    action: string;
    img: string;
    order: number;
    entryName: string;
    category: string;
    isBroken: boolean;
    isFocus: boolean | undefined;
    isRitual: boolean | undefined;
    isCharges: boolean;
    isStaff: boolean | undefined;
    isInnate: boolean | undefined;
    isPrepared: boolean | undefined;
    isSpontaneous: boolean | undefined;
    isFlexible: boolean | undefined;
    annotation: AuxiliaryActionPurpose;
    consumable: ConsumablePF2e | undefined;
    range: string;
    rank: ZeroToTen;
    uses: (ValueAndMax & { input: string; itemId: string }) | undefined;
};
type SummarizedSpellsData = {
    labels: string[];
    spells: SummarizedSpell[][];
    focusPool: {
        value: number;
        max: number;
        cap?: number;
    };
    isOwner: boolean;
    hasFocusCantrip: boolean;
};

export {
    createSpellcastingSource,
    createSpellcastingWithHighestStatisticSource,
    getActorMaxRank,
    getHighestSpellcastingStatistic,
    getHighestSyntheticStatistic,
    getSummarizedSpellsDataForRender,
};

export type {
    CreateSpellcastingSource,
    CreateSpellcastingSourceWithHighestStatistic,
    SummarizedSpellsData,
};
