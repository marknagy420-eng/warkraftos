export const QUESTS = {
    Q001_ShadowAwakening: {
        id: 'Q001_ShadowAwakening',
        type: 'main_quest',
        title: 'Az Árnyékok Felébredése',
        giver: 'NPC_SerenCaptain',
        location_start: 'Village_Blackmoor',
        requirements: ['player_level >= 1'],
        rewards: {
            xp: 500,
            gold: 100,
            item: 'Shadow_Resistance_Amulet',
            unlock_ability: 'Shadow_Sense'
        },
        states: [
            {
                id: 'START',
                trigger: 'talk_to(NPC_SerenCaptain)',
                dialogue: [
                    'Seren: "Az erőd... nem üres. Valami ott van."'
                ],
                objectives: [
                    'investigate_area(Blackmoor_Forest, count=3)',
                    'collect_item(Shadow_Residue, count=5)'
                ],
                on_complete: 'ENTER_FORT'
            },
            {
                id: 'ENTER_FORT',
                trigger: 'objectives_completed',
                events: [
                    'spawn_enemy(type=Shadow_Wisp, count=5, area=Fort_Entrance)',
                    'apply_debuff(player, Shadow_Whisper, duration=60)'
                ],
                objectives: [
                    'enter_location(Blackmoor_Fort)',
                    'find_npc(NPC_SurvivorSoldier)'
                ],
                on_complete: 'SURVIVOR_DIALOGUE'
            },
            {
                id: 'SURVIVOR_DIALOGUE',
                trigger: 'talk_to(NPC_SurvivorSoldier)',
                dialogue: [
                    'Soldier: "A falak... mozogtak... nem voltak valódiak..."'
                ],
                objectives: [
                    'activate_object(Torch_1)',
                    'activate_object(Torch_2)',
                    'activate_object(Torch_3)'
                ],
                puzzle: {
                    type: 'sequence',
                    correct_order: ['Torch_2', 'Torch_1', 'Torch_3']
                },
                on_complete: 'INNER_KEEP'
            },
            {
                id: 'INNER_KEEP',
                trigger: 'puzzle_completed',
                events: [
                    'close_doors(area=Fort_Inner)',
                    'spawn_enemy(type=Shadow_Knight, count=3)'
                ],
                objectives: [
                    'reach_location(Fort_Core)'
                ],
                on_complete: 'BOSS_FIGHT'
            },
            {
                id: 'BOSS_FIGHT',
                trigger: 'enter_area(Fort_Core)',
                boss: {
                    id: 'Shadow_Avatar',
                    phases: [
                        { phase: 1, abilities: ['Shadow_Slash', 'Teleport'] },
                        { phase: 2, abilities: ['Clone_Spawn'], spawn: 'Shadow_Clone x3' },
                        { phase: 3, abilities: ['Darkness_Field'], effect: 'reduce_vision(player, 70%)' }
                    ]
                },
                objectives: [
                    'defeat(Shadow_Avatar)'
                ],
                on_complete: 'REVEAL'
            },
            {
                id: 'REVEAL',
                trigger: 'boss_defeated',
                events: [
                    'spawn_npc(NPC_EldrinMage)'
                ],
                dialogue: [
                    'Eldrin: "Én... csak meg akartam érteni őket."',
                    'Eldrin: "Az árnyak... nem gonoszak. Valami felébresztette őket."'
                ],
                choice: [
                    { id: 'TRUST', text: 'Segítek neked.', result: 'END_GOOD' },
                    { id: 'ACCUSE', text: 'Te okoztad ezt!', result: 'END_NEUTRAL' }
                ]
            },
            {
                id: 'END_GOOD',
                events: [
                    'add_reputation(Mages, +10)',
                    'unlock_story_flag(Eldrin_Ally)'
                ],
                end_quest: true
            },
            {
                id: 'END_NEUTRAL',
                events: [
                    'add_reputation(Mages, -5)',
                    'unlock_story_flag(Eldrin_Suspect)'
                ],
                end_quest: true
            }
        ]
    }
};
