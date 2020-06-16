import { WebhookClient, MessageEmbed, Constants, WebhookMessageOptions, MessageOptions } from 'discord.js';
import TextChannel from '../structures/discord.js/TextChannel';
import { Events } from '../util/Client';
import { EventResponses } from '../util/Constants';

export default (async member => {
	const { client, user, guild } = member;
	const config = guild && client.config.guilds.get(guild.id);
  
	if (!config || !guild || user.bot) return;
  
	const isMuted = client.mutes.has(`${guild.id}:${user.id}`);
	if (isMuted) {
		await member.roles.add(guild.roles.cache.find(role => role.name === 'Muted')!);
	}
	const hookOrChannel = config.webhooks.get('welcome-messages') ||
		(guild.channels.cache.find(ch => ch.type === 'text' && ch.name === 'general') as TextChannel);
	const isWebhook = hookOrChannel instanceof WebhookClient;
	if (hookOrChannel && !isMuted) {
		const options = {} as MessageOptions | WebhookMessageOptions;
		Object.assign(options, EventResponses.GUILD_MEMBER_ADD(member, isWebhook));

		if (isWebhook) {
			(options as WebhookMessageOptions).username = 'Welcome';
		}
		hookOrChannel.send(options)
			.catch(console.error);
	}
	const hook = config.webhooks.get('member-logs');
	if (!hook) return;
	// This will be added to constants at a later date
	const embed = new MessageEmbed()
		.setAuthor(user.tag)
		.setColor(Constants.Colors.GREEN)
		.setDescription(`${user} (${user.id}) Joined`)
		.setFooter(user.id)
		.setTimestamp(member.joinedAt!)
		.setThumbnail(user.displayAvatarURL({ dynamic: true }));
	hook.send({
		embeds: [embed],
		username: 'Member Joined'
	}).catch(console.error);
}) as (...args: Events['guildMemberAdd']) => void;