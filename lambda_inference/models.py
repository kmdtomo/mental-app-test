import torch
from transformers import Wav2Vec2Model, Wav2Vec2Config

class CustomWav2Vec2Model(Wav2Vec2Model):
    config_class = Wav2Vec2Config
    
    def __init__(self, config):
        super().__init__(config)
        self.fc = torch.nn.Linear(1024, 3)
        self.init_weights()

    def forward(self, input_values):
        output = super().forward(input_values)
        x = torch.mean(output.last_hidden_state, dim=1)
        x = self.fc(x)
        return x.squeeze()
