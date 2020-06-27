import { Permissions } from 'discord.js';
import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

export default class Warn extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: 'Moderation',
			cooldown: 5,
			name: 'warn',
			permissions: member => {
				const config = member.client.config.guilds.get(member.guild.id);
				if (!config) return false;
				const hasAccess = config.accessLevelRoles.some(
					roleID => member.roles.cache.has(roleID)
				);
				if (
					hasAccess || member.hasPermission(Permissions.FLAGS.ADMINISTRATOR)
				) return true;
        
				return false;
			},
			usages: [{
				required: true,
				type: 'user'
			}, {
				type: '--silent=true'
			}, {
				required: true,
				type: 'reason'
			}]
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		await message.delete();
		const { users, reason, members, flags: { silent } } = await Util.reason(message, {
			fetchMembers: true, withFlags: [{
				name: 'silent',
				type: 'boolean'
			}]
		});

		if (!reason) throw new CommandError('PROVIDE_REASON');
		if (!users.size) throw new CommandError('MENTION_USERS');

		const notManageable = members.filter(member => !Util.manageable(member, message.member!));
		if (notManageable.size) throw new CommandError(
			'CANNOT_ACTION_USER', 'WARN', members.size > 1
		);

		const timestamp = new Date();

		let context: GuildMessage<true> | undefined;

		if (!silent) context = await send(Responses.WARN_SUCCESS(users.array(), reason));

		const { id: caseID } = await Util.sendLog({
			action: 'WARN',
			context,
			extras: {},
			guild: message.guild!,
			moderator: message.author,
			reason,
			screenshots: [],
			users: users.array()
		});

		await Promise.all(
			users.map(user => this.client.database.newWarn(
				message.guild!, user, message.author, { caseID, reason, timestamp }
			))
		);

		return context;
	}
}