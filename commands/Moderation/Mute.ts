import ms from '@naval-base/ms';
import { Permissions, PermissionOverwriteOption } from 'discord.js';
import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses, Defaults } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

export default class Mute extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: 'Moderation',
			cooldown: 5,
			examples: [
				'{author} 1h Being too cool!',
				'{author.id} 1d Being too fancy!',
				'{author} {randommemberid} 1w Trollers!'
			],
			name: 'mute',
			permissions: member => {
				const config = member.guild.config;
				if (!config) return null;
				const hasAccess = config.accessLevelRoles.some(
					roleID => member.roles.cache.has(roleID)
				);
				if (
					hasAccess || member.hasPermission(Permissions.FLAGS.ADMINISTRATOR)
				) return true;
        
				return false;
			}
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		await message.delete();
		const { members, users, reason, time, flags: { silent } } = Util.parseMS(await Util.reason(message, {
			argsOverload: args.regular, fetchMembers: true, withFlags: [{
				name: 'silent',
				type: 'boolean'
			}]
		}));
		
		if (time < 120e3 || time > 6048e5) {
			const isSmaller = time < 120e3;
			throw new CommandError('INVALID_TIME', {
				small: isSmaller,
				time: isSmaller ? '2 minutes' : '7 days'
			});
		}

		if (!reason) throw new CommandError('PROVIDE_REASON');
		if (!members.size) {
			throw new CommandError('MENTION_USERS', false);
		}

		const notManageable = members.filter(member => !Util.manageable(member, message.member!));
		if (notManageable.size) throw new CommandError(
			'CANNOT_ACTION_USER', 'MUTE', members.size > 1
		);

		const extras: { [key: string]: string } = { };

		if (members.size !== users.size) {
			const left = users.filter(user => !members.has(user.id));
			extras.Note = `${left.size} Other user${left.size > 1 ?
				's were' : ' was'
			} attempted to be muted, however they have left.`;
		}

		const alreadyMuted = members.filter(
			member => this.client.database.cache.mutes.has(`${message.guild.id}:${member.id}`)
		);
		if (alreadyMuted.size) {
			if (alreadyMuted.size === members.size) {
				throw new CommandError('ALL_MUTED');
			}
			extras.Note = `${extras.Note ?
				`${extras.Note}\nNote: ` : ''
			}${alreadyMuted.size} Other member${alreadyMuted.size > 1 ?
				's were' : ' was'
			} attempted to be muted, but was already muted.`;
		}

		const start = new Date();
		const end = new Date(start.getTime() + time);

		const muteLength = extras['Mute Length'] = ms(end.getTime() - start.getTime(), true);

		const filtered = members.filter(member => !alreadyMuted.keyArray().includes(member.id));

		let context: GuildMessage<true> | undefined;

		if (!silent) context = await send(Responses.MUTE_SUCCESS(filtered.array(), reason));

		await Util.sendLog({
			action: 'MUTE',
			context,
			extras,
			guild: message.guild,
			moderator: message.author,
			reason,
			screenshots: [],
			users: filtered.map(({ user }) => user)
		});
			
		// have to non-null assert
		const guild = message.guild!;
		// Dynamic muted role
		let role = guild.roles.cache.find(role => role.name === 'Muted');
		if (!role) {
			role = await guild.roles.create({ data: Defaults.MUTE_ROLE_DATA });
			const permissionsObject = {
				SEND_MESSAGES: false,
				SPEAK: false
			} as PermissionOverwriteOption;

			for (const channel of guild.channels.cache.values()) {
				const permissions = channel.permissionsFor(role)!;
				if (channel.type !== 'category') {
					if (
						permissions.has(Permissions.FLAGS.SEND_MESSAGES) &&
							channel.permissionsLocked &&
							channel.parent
					) {
						await channel.parent.createOverwrite(role, permissionsObject);
						continue;
					}
				}

				if (!permissions.has(Permissions.FLAGS.SEND_MESSAGES)) {
					await channel.createOverwrite(role, permissionsObject);
				}
			}
		}

		for (const member of filtered.values()) {
			await member.roles.add(role);
			await this.client.database.createMute({
				endDate: end,
				guild: message.guild,
				start,
				user: member.user
			});
			try {
				await member.send(Responses.DM_PUNISHMENT_ACTION(message.guild, 'MUTE', reason, muteLength));
			} catch {} // eslint-disable-line no-empty
		}

		return context;
	}
}