package fr.brio;

import org.springframework.boot.SpringApplication;

public class TestBrioBackendApplication {

	public static void main(String[] args) {
		SpringApplication.from(BrioBackendApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
