import {
	PermissionResolvable, Snowflake, MessageAdditions,
	MessageOptions, StringResolvable, MessageEditOptions
} from 'discord.js';
import CommandArguments from './CommandArguments';
import GuildMember from './discord.js/GuildMember';
import TextChannel from './discord.js/TextChannel';
import Client from '../util/Client';
import CommandManager from '../util/CommandManager';
import { GuildMessage, Message } from '../util/Types';

export default class Command {
	public aliases: string[];
	public category: string;
	public client!: Client;
	public cooldown: Exclude<CommandOptions['cooldown'], undefined>;
	public cooldowns = new Map<Snowflake, NodeJS.Timeout>();
	public manager!: CommandManager;
	public name: CommandOptions['name'];
	public permissions: Exclude<CommandOptions['permissions'], undefined>;
	public path: string;

	private _usages: CommandOptions['usages'];

	constructor(manager: CommandManager, options: CommandOptions, path: string) {
		Object.defineProperties(this, {
			client: { value: manager.client },
			manager: { value: manager }
		});

		this.aliases = options.aliases;
		this.category = options.category;
		this.cooldown = options.cooldown ?? 3;
		this.name = options.name;
		this.permissions = options.permissions ?? 0;
		this.path = path;

		this._usages = options.usages;
	}

	public get usages() {
		return this._usages.map(
			usage =>
				(usage.required ? '[' : '<') +
				(usage.extras ? [usage.type, ...usage.extras].join(' | ') : usage.type) +
				(usage.required ? ']' : '>')
		);
	}

	public reload() {
		if (!this.path) return Promise.reject(new Error('This command doesn\'t have a valid path'));
		delete require.cache[this.path];
		return this.manager.load(this);
	}

	public run(message: GuildMessage<true>, args: CommandArguments, {
		send,
		edited = false
	}: CommandData): Promise<Message | void> {
		if (edited) return Promise.resolve();
		return send('No implementation for command');
	}
}

export interface CommandData<> {
	edited?: boolean;
	send(
		options: MessageAdditions | MessageEditOptions | MessageOptions
	): Promise<GuildMessage<true>>;
	send(
		content: StringResolvable,
		options?: MessageAdditions | MessageOptions | MessageEditOptions
	): Promise<GuildMessage<true>>;
}

export interface CommandOptions {
	aliases: string[];
	category: string;
	cooldown?: number;
	name: string;
	permissions?: PermissionResolvable | PermissionsFunction;
	usages: CommandUsage[];
}

export type CommandUsage = {
	required?: boolean;
	type: string;
	extras?: string[];
};

type PermissionsFunction = (
	member: GuildMember,
	channel: TextChannel,
) => boolean | string | Promise<boolean | string>;
