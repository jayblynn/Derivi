import { Client, Snowflake } from 'discord.js';
import { Defaults } from '../util/Constants';

export default class Mute {
	public readonly client!: Client;
	public endTimestamp: number;
	public startedTimestamp: number;
	public userID: Snowflake;
	public guildID: Snowflake;

	constructor(client: Client, data: RawMute) {
		Object.defineProperty(this, 'client', { value: client });

		this.endTimestamp = new Date(data.end).getTime();
		this.startedTimestamp = new Date(data.start).getTime();
		this.userID = data.user_id;
		this.guildID = data.guild_id;
	}

	public fetchUser(cache = true) {
		return this.client.users.fetch(this.userID, cache);
	}

	get endAt() {
		return new Date(this.endTimestamp);
	}

	get guild() {
		return this.client.guilds.resolve(this.guildID)!;
	}

	get startedAt() {
		return new Date(this.startedTimestamp);
	}

	get user() {
		return this.client.users.resolve(this.userID);
	}

	public delete() {
		return this.client.database.deleteMute(this.guild, this.userID);
	}

	public async unmute() {
		const role = this.guild.roles.cache.find(role => role.name === 'Muted') || await this.guild.roles.create({
			data: Defaults.MUTE_ROLE_DATA
		});
		try {
			const member = await this.guild.members.fetch(this.userID);
			if (member.roles.cache.has(role.id)) {
				await member.roles.remove(role);
			}
		} catch { } // eslint-disable-line no-empty
		return this.delete();
	}
}

export interface RawMute {
	guild_id: Snowflake;
	end: Date;
	start: Date;
	user_id: Snowflake;
}
