package email

import "time"

type Service interface {
	SendInvitation(
		recipient string,
		name string,
		projectName string,
		inviteURL string,
		expiresAt time.Time,
	) error
}
